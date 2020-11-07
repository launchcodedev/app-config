#!/usr/bin/env node

import * as yargs from 'yargs';

const { argv: _ } = yargs
  .strict()
  .version()
  .command('*', '', async () => {});
