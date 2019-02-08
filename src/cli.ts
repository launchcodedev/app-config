#!/usr/bin/env node

import * as execa from 'execa';
import * as TOML from '@iarna/toml';
import * as Yargs from 'yargs';
import * as refParser from 'json-schema-ref-parser';
import * as PrettyError from 'pretty-error';
import { stripIndent } from 'common-tags';
import { pathExists, readFile, outputFile } from 'fs-extra';
import { flattenObjectTree } from './util';
import { loadConfig, LoadedConfig, ConfigSource } from './config';
import { loadValidated } from './schema';
import { generateTypeFiles } from './meta';
import { stringify, extToFileType } from './file-loader';

const wrapCommand = <T>(cmd: (arg: T) => Promise<void> | void) => async (arg: T) => {
  try {
    await cmd(arg);
  } catch (err) {
    console.log();
    console.error(new PrettyError().render(err));

    let name = process.cwd();

    try {
      name = require(`${process.cwd()}/package.json`).name;
    } catch (_) {}

    console.error(`Error occurred in ${name}`);
    process.exit(1);
  }
};

const flattenConfig = (loaded: LoadedConfig, argv: Yargs.Arguments) => {
  const {
    secrets,
    prefix,
  } = argv;

  const {
    config: fullConfig,
    nonSecrets,
  } = loaded;

  const config = (secrets ? fullConfig : nonSecrets) as any;

  return [config, flattenObjectTree(config, prefix)];
};

const argv = Yargs
  .usage('Usage: $0 <command>')
  .usage('')
  .option('C', {
    alias: 'cwd',
    default: process.cwd(),
    nargs: 1,
    type: 'string',
    description: 'Run app-config in the context of this directory',
  })
  .option('s', {
    alias: 'secrets',
    default: false,
    nargs: 0,
    type: 'boolean',
    description: 'Include config secrets in the generated environment variables',
  })
  .command(['variables', 'vars', 'v'], 'Print out the generated environment variables',
    yargs => yargs
      .option('p', {
        alias: 'prefix',
        default: 'APP_CONFIG',
        nargs: 1,
        type: 'string',
        description: 'Prefix environment variables',
      })
      .example(
        'export $($0 vars | xargs)',
        'Export the generated environment variables to the current shell',
      ),
    wrapCommand(async (argv) => {
      const loaded = await loadValidated(argv.cwd);

      const [_, flattenedConfig] = flattenConfig(loaded, argv);

      console.log(
        Object.entries(flattenedConfig)
          .map(([key, value]) => `${key}=${value}`)
          .join('\n'),
      );
    }),
  )
  .command(['create', 'c'], 'Outputs the current configuration in a specific format',
    yargs => yargs
      .example(
        '$0 --format yaml',
        'Print out the configuration in yaml format',
      )
      .example(
        '$0 --format yaml --select "#/kubernetes"',
        'Print out only the value of config.kubernetes',
      )
      .option('f', {
        alias: 'format',
        default: 'toml',
        nargs: 1,
        type: 'string',
        description: 'toml/yaml/json',
      })
      .option('select', {
        default: '#',
        nargs: 1,
        type: 'string',
        description: 'a json pointer for what to select in the config',
      }),
    wrapCommand(async ({ cwd, format, select, secrets }) => {
      const { config, nonSecrets } = await loadValidated(cwd);

      const output = secrets ? config : nonSecrets;
      const refs = await refParser.resolve(output);

      console.log(stringify(refs.get(select) as any, extToFileType(format)));
    }),
  )
  .command(['generate', 'gen', 'g'], 'Run code generation as specified by the app-config file',
    yargs => yargs,
    wrapCommand(async ({ cwd }) => {
      const output = await generateTypeFiles(cwd);

      if (output.length === 0) {
        console.warn('No files generated - did you add the correct meta properties?');
      } else {
        console.log(`Generated: [ ${output.map(({ file }) => file).join(', ')} ]`);
      }
    }),
  )
  .command(['init'], 'Creates the boilerplate for your project',
    yargs => yargs
      .option('force', {
        default: false,
        type: 'boolean',
      }),
    wrapCommand(async ({ cwd, force }) => {
      process.chdir(cwd);

      await loadConfig()
        .catch(_ => null)
        .then((res) => {
          if (res !== null && res.source === ConfigSource.File && !force) {
            throw new Error('an app config file already existed');
          }
        });

      await outputFile('.app-config.toml', '');
      console.log('.app-config.toml file written');

      await outputFile('.app-config.secrets.toml', '');
      console.log('.app-config.secrets.toml file written');

      await outputFile('.app-config.schema.yml', stripIndent`
        $schema: http://json-schema.org/draft-07/schema#

        type: object
        required: []
        properties: {}
        definitions: {}
      `);
      console.log('.app-config.schema.yml file written');

      if (await pathExists('.gitignore')) {
        const contents = await readFile('.gitignore');
        await outputFile('.gitignore', `${contents}\n*app-config.secrets.*`);
        console.log('app-config secrets gitignored');
      }
    }),
  )
  .command('*', 'Exports config as individual environment variables for the specified command',
    yargs => yargs
      .option('p', {
        alias: 'prefix',
        default: 'APP_CONFIG',
        nargs: 1,
        type: 'string',
        description: 'Prefix environment variables',
      })
      .example(
        '$0 -- docker-compose up -d',
        'Run Docker Compose with the generated environment variables',
      ),
    wrapCommand(async ({ _, cwd, prefix }) => {
      const [command, ...args] = _;

      if (!command) {
        Yargs.showHelp();
        return;
      }

      const loaded = await loadValidated(cwd);

      const [config, flattenedConfig] = flattenConfig(loaded, argv);

      await execa(
        command,
        args,
        {
          env: {
            [prefix]: TOML.stringify(config),
            ...flattenedConfig,
          },
          stdio: 'inherit',
        },
      ).catch((err) => {
        if (err.failed) {
          console.error(`Failed to run command '${err.cmd}': Error code ${err.code}`);
        } else {
          console.error(err.message);
        }
        process.exit(1);
      });
    }),
  )
  .version()
  .help()
  .strict()
  .argv;
