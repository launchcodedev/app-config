#!/usr/bin/env node

import getConfig from '.';
import * as execa from 'execa';
import { flattenObjectTree } from './util';
import * as TOML from '@iarna/toml';

const command = process.argv[2];
const args = process.argv.slice(3);

const config = getConfig();

const prefix = 'APP_CONFIG';

const flattenedConfig = flattenObjectTree(config, prefix);

if (command === '--vars') {
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
      [prefix]: TOML.stringify(config),
      ...process.env,
      ...flattenedConfig,
    },
    stdio: 'inherit',
  },
);
