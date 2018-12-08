#!/usr/bin/env node

import * as execa from 'execa';
import * as TOML from '@iarna/toml';
import * as Yargs from 'yargs';
import { flattenObjectTree } from './util';
import { loadConfig } from '.';

const argv = Yargs
  .usage('Usage: $0 <command>')
  .usage('')
  .usage('Exports config as individual environment variables for the specified command')
  .example(
    '$0 -- docker-compose up -d',
    'Run Docker Compose with the generated environment variables',
  )
  .example(
    '$0 --vars',
    'Print out the generated environment variables',
  )
  .example(
    'export $($0 -V | xargs)',
    'Export the generated environment variables to the current shell',
  )
  .option('v', {
    alias: 'vars',
    default: false,
    nargs: 0,
    type: 'boolean',
    description: 'Print out the generated environment variables',
  })
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
  .version()
  .help()
  .strict()
  .argv;

const [command, ...args] = argv._;

if (!command && !argv.vars) {
  Yargs.showHelp();
  process.exit(1);
}

(async () => {
  const {
    config: fullConfig,
    nonSecrets,
  } = await loadConfig();

  const { prefix } = argv;
  const config = (argv.secrets ? fullConfig : nonSecrets) as any;
  const flattenedConfig = flattenObjectTree(config, prefix);

  if (!command && argv.vars) {
    console.log(
      Object.entries(flattenedConfig)
        .map(([key, value]) => `${key}=${value}`)
        .join('\n'),
    );

    return;
  }

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
  )
  .catch((err) => {
    if (err.failed) {
      console.error(`Failed to run command '${err.cmd}': Error code ${err.code}`);
    } else {
      console.error(err.message);
    }
    process.exit(1);
  });
})();
