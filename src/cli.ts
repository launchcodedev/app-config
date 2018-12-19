#!/usr/bin/env node

import * as execa from 'execa';
import * as TOML from '@iarna/toml';
import * as Yargs from 'yargs';
import * as PrettyError from 'pretty-error';
import { flattenObjectTree } from './util';
import { LoadedConfig } from './config';
import { loadSchema, validate, loadValidated } from './schema';
import { generateTypeFiles } from './meta';

const wrapCommand = <T>(cmd: (arg: T) => Promise<void> | void) => async (arg: T) => {
  try {
    await cmd(arg);
  } catch (err) {
    console.log();
    console.error(new PrettyError().render(err));
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
  .option('s', {
    alias: 'secrets',
    default: false,
    nargs: 0,
    type: 'boolean',
    description: 'Include config secrets in the generated environment variables',
  })
  .option('p', {
    alias: 'prefix',
    default: 'APP_CONFIG',
    nargs: 1,
    type: 'string',
    description: 'Prefix environment variables',
  })
  .command(['variables', 'vars', 'v'], 'Print out the generated environment variables',
    yargs => yargs
      .example(
        'export $($0 vars | xargs)',
        'Export the generated environment variables to the current shell',
      ),
    wrapCommand(async () => {
      const loaded = await loadValidated();

      const [_, flattenedConfig] = flattenConfig(loaded, argv);

      console.log(
        Object.entries(flattenedConfig)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n'),
      );
    }),
  )
  .command(['generate', 'gen', 'g'], 'Run code generation as specified by the app-config file',
    yargs => yargs,
    wrapCommand(async () => {
      const output = await generateTypeFiles();

      if (output.length === 0) {
        console.warn('No files generated - did you add the correct meta properties?');
      } else {
        console.log(`Generated: [ ${output.map(({ file }) => file).join(', ')} ]`);
      }
    }),
  )
  .command('*', 'Exports config as individual environment variables for the specified command',
    yargs => yargs
      .example(
        '$0 -- docker-compose up -d',
        'Run Docker Compose with the generated environment variables',
      ),
    wrapCommand(async ({ _, prefix }) => {
      const [command, ...args] = _;

      if (!command) {
        Yargs.showHelp();
        return;
      }

      const loaded = await loadValidated();

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
