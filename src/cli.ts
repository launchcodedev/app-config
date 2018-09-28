#!/usr/bin/env node

import config from '.';
import * as execa from 'execa';
import { flattenObjectTree } from './util';
import * as TOML from '@iarna/toml';
import * as Yargs from 'yargs';

const description =
'Exports TOML properties as individual key-value environment variables for the specified command';

const argv = Yargs
  .usage('Usage: $0 <command>')
  .usage('')
  .usage(description)
  .example(
    '$0 docker-compose up -d',
    'Run Docker Compose with the generated environment variables',
  )
  .example(
    '$0 --vars',
    'Print out the generated environment variables',
  )
  .example(
    'export $($0 --vars | xargs)',
    'Export the generated environment variables to the current shell',
  )
  .option('V', {
    alias: 'vars',
    default: false,
    nargs: 0,
    type: 'boolean',
    description: 'Print out the generated environment variables',
  })
  .version()
  .help()
  .argv;

const [command] = argv._;
const args = process.argv.slice(3);

if (!command && !argv.vars) {
  Yargs.showHelp();
  process.exit(1);
}

const prefix = 'APP_CONFIG';
const flattenedConfig = flattenObjectTree(config, prefix);

if (!command && argv.vars) {
  console.log(
    Object.entries(flattenedConfig)
      .map(([key, value]) => `${key}=${value}`)
      .join('\n'),
  );
  process.exit(0);
}

execa(
  command,
  args,
  {
    env: {
      [prefix]: TOML.stringify(config as any),
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
