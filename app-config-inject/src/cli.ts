#!/usr/bin/env node

import * as yargs from 'yargs';
import { setLogLevel, LogLevel } from '@app-config/logging';
import { consumeStdin } from '@app-config/node';
import { injectHtml } from './index';

// we can't have it interfere with our stdout
setLogLevel(LogLevel.None);

export const cli = yargs
  .strict()
  .version()
  .help('h', 'Shows help message with examples and options')
  .alias('h', 'help')
  .command({
    command: '*',
    describe: 'Reads HTML from stdin and outputs to stdout',
    builder: (args) =>
      args
        .option('validate', {
          type: 'boolean',
          default: true,
          alias: 'v',
          description: 'Whether config should be checked against the schema',
        })
        .option('dir', {
          type: 'string',
          description: 'Where to find the app-config file',
        })
        .option('schema-dir', {
          type: 'string',
          description: 'Where to find the app-config schema, if validating',
        }),
    async handler({
      validate,
      dir,
      schemaDir,
    }: {
      validate: boolean;
      dir?: string;
      schemaDir?: string;
    }) {
      const html = await consumeStdin();
      const injected = await injectHtml(html, {
        validate,
        configOptions: { directory: dir },
        schemaOptions: { directory: schemaDir },
      });

      process.stdout.write(injected);
      process.stdout.write('\n');
      process.stderr.write('Injected HTML from stdin!\n');
    },
  });

if (require.main === module) {
  cli.parse();
}
