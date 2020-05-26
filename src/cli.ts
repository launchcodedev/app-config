#!/usr/bin/env node

import * as execa from 'execa';
import * as Yargs from 'yargs';
import * as refParser from 'json-schema-ref-parser';
import * as PrettyError from 'pretty-error';
import { stripIndent } from 'common-tags';
import { pathExists, readFile, outputFile } from 'fs-extra';
import { flattenObjectTree } from './util';
import { loadConfig, LoadedConfig, ConfigSource } from './config';
import { loadValidated, loadSchema } from './schema';
import { generateTypeFiles } from './generate';
import { stringify, extToFileType } from './file-loader';

const wrapCommand = <T>(cmd: (arg: Yargs.Arguments<T>) => Promise<void> | void) => async (
  arg: Yargs.Arguments<T>,
) => {
  try {
    await cmd(arg);
  } catch (err) {
    console.log();
    console.error(new PrettyError().render(err));

    let name = process.cwd();

    try {
      // eslint-disable-next-line import/no-dynamic-require,global-require
      name = require(`${process.cwd()}/package.json`).name;
    } catch (_) {
      /* allowed */
    }

    console.error(`Error occurred in ${name}`);
    process.exit(1);
  }
};

const flattenConfig = (loaded: LoadedConfig, argv: { secrets: boolean; prefix: string }) => {
  const { secrets, prefix } = argv;

  const { config: fullConfig, nonSecrets } = loaded;

  const config = (secrets ? fullConfig : nonSecrets) as any;

  return [config, flattenObjectTree(config, prefix)];
};

type BaseArgs = { cwd: string; secrets: boolean };

const { argv: _ } = Yargs.usage('Usage: $0 <command>')
  .usage('')
  .option('cwd', {
    alias: 'C',
    default: process.cwd(),
    nargs: 1,
    type: 'string',
    description: 'Run app-config in the context of this directory',
  })
  .option('secrets', {
    alias: 's',
    default: false,
    nargs: 0,
    type: 'boolean',
    description: 'Include config secrets in the generated environment variables',
  })
  .command<BaseArgs & { prefix: string }>(
    ['variables', 'vars', 'v'],
    'Print out the generated environment variables',
    (yargs: Yargs.Argv<BaseArgs>) =>
      yargs
        .option('prefix', {
          alias: 'p',
          default: 'APP_CONFIG',
          nargs: 1,
          type: 'string',
          description: 'Prefix environment variables',
        })
        .example(
          'export $($0 vars | xargs)',
          'Export the generated environment variables to the current shell',
        ),
    wrapCommand<BaseArgs & { prefix: string }>(async argv => {
      const loaded = await loadValidated(argv.cwd);

      const [_, flattenedConfig] = flattenConfig(loaded, argv);

      console.log(
        Object.entries(flattenedConfig)
          .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
          .join('\n'),
      );
    }),
  )
  .command<BaseArgs & { format: string; select: string }>(
    ['create', 'c'],
    'Outputs the current configuration in a specific format',
    (yargs: Yargs.Argv<BaseArgs>) =>
      yargs
        .example('$0 --format json', 'Print out the configuration in json format')
        .example(
          '$0 --format json --select "#/kubernetes"',
          'Print out only the value of config.kubernetes',
        )
        .option('format', {
          alias: 'f',
          default: 'yaml',
          nargs: 1,
          type: 'string',
          description: 'yaml/toml/json',
        })
        .option('select', {
          default: '#',
          nargs: 1,
          type: 'string',
          description: 'a json pointer for what to select in the config',
        }),
    wrapCommand<BaseArgs & { format: string; select: string }>(async argv => {
      const { cwd, format, select, secrets } = argv;
      const { config, nonSecrets } = await loadValidated(cwd);

      const output = secrets ? config : nonSecrets;
      const refs = await refParser.resolve(output);

      console.log(stringify(refs.get(select) as any, extToFileType(format)));
    }),
  )
  .command<BaseArgs & { format: string; select: string }>(
    ['create-schema'],
    'Outputs the current schema in a specific format',
    (yargs: Yargs.Argv<BaseArgs>) =>
      yargs
        .example('$0 --format json', 'Print out the schema in json format')
        .option('format', {
          alias: 'f',
          default: 'yaml',
          nargs: 1,
          type: 'string',
          description: 'yaml/toml/json',
        })
        .option('select', {
          default: '#',
          nargs: 1,
          type: 'string',
          description: 'a json pointer for what to select in the schema',
        }),
    wrapCommand<BaseArgs & { format: string; select: string }>(async argv => {
      const { cwd, format, select } = argv;
      const { schema } = await loadSchema(cwd);

      const normalized = await refParser.dereference(schema);
      const refs = await refParser.resolve(normalized);

      console.log(stringify(refs.get(select) as any, extToFileType(format)));
    }),
  )
  .command<BaseArgs>(
    ['generate', 'gen', 'g'],
    'Run code generation as specified by the app-config file',
    (yargs: Yargs.Argv<BaseArgs>) => yargs,
    wrapCommand<BaseArgs>(async ({ cwd }) => {
      const output = await generateTypeFiles(cwd);

      if (output.length === 0) {
        console.warn('No files generated - did you add the correct meta properties?');
      } else {
        console.log(`Generated: [ ${output.map(({ file }) => file).join(', ')} ]`);
      }
    }),
  )
  .command<BaseArgs & { force: boolean }>(
    ['init'],
    'Creates the boilerplate for your project',
    (yargs: Yargs.Argv<BaseArgs>) =>
      yargs.option('force', {
        default: false,
        type: 'boolean',
      }),
    wrapCommand<BaseArgs & { force: boolean }>(async ({ cwd, force }) => {
      process.chdir(cwd);

      await loadConfig()
        .catch(_ => null)
        .then(res => {
          if (res !== null && res.source === ConfigSource.File && !force) {
            throw new Error('an app config file already existed');
          }
        });

      await outputFile('.app-config.yml', '');
      console.log('.app-config.yml file written');

      await outputFile('.app-config.secrets.yml', '');
      console.log('.app-config.secrets.yml file written');

      await outputFile(
        '.app-config.schema.yml',
        stripIndent`
        $schema: http://json-schema.org/draft-07/schema#

        type: object
        required: []
        properties: {}
        definitions: {}
      `,
      );
      console.log('.app-config.schema.yml file written');

      if (await pathExists('.gitignore')) {
        const contents = await readFile('.gitignore');
        await outputFile('.gitignore', `${contents}\n*app-config.secrets.*`);
        console.log('app-config secrets gitignored');
      }
    }),
  )
  .command<BaseArgs & { prefix: string; format: string }>(
    '*',
    'Exports config as individual environment variables for the specified command',
    (yargs: Yargs.Argv<BaseArgs>) =>
      yargs
        .option('prefix', {
          alias: 'p',
          default: 'APP_CONFIG',
          nargs: 1,
          type: 'string',
          description: 'Prefix environment variables',
        })
        .option('format', {
          alias: 'f',
          default: 'yaml',
          nargs: 1,
          type: 'string',
          description: 'yaml/toml/json',
        })
        .example(
          '$0 -- docker-compose up -d',
          'Run Docker Compose with the generated environment variables',
        ),
    wrapCommand<BaseArgs & { prefix: string; format: string }>(async argv => {
      const { _, cwd, prefix, format } = argv;
      const [command, ...args] = _;

      if (!command) {
        Yargs.showHelp();
        return;
      }

      const loaded = await loadValidated(cwd);

      const [config, flattenedConfig] = flattenConfig(loaded, argv);

      await execa(command, args, {
        env: {
          [prefix]: stringify(config, extToFileType(format)),
          ...flattenedConfig,
        },
        stdio: 'inherit',
      }).catch(err => {
        if (err.failed) {
          console.error(`Failed to run command '${err.command}': Error code ${err.exitCode}`);
        } else {
          console.error(err.message);
        }
        process.exit(1);
      });
    }),
  )
  .version()
  .help()
  .strict();
