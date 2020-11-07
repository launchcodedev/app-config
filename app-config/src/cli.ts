#!/usr/bin/env node

import * as yargs from 'yargs';
import execa from 'execa';
import { resolve } from 'json-schema-ref-parser';
import { flattenObjectTree, Json, JsonObject } from './common';
import { FileType, stringify } from './config-source';
import { Configuration, loadConfig } from './config';
import { loadSchema } from './schema';

function subcommand<Options extends { [name: string]: yargs.Options }>(
  {
    name,
    description,
    examples = [],
  }: {
    name: string | string[];
    description?: string;
    examples?: [string, string][];
  },
  options: Options,
  fn: (args: yargs.InferredOptionTypes<Options> & { _: string[] }) => Promise<void> | void,
): yargs.CommandModule {
  const [command, ...aliases] = Array.isArray(name) ? name : [name];

  return {
    command,
    aliases,
    describe: description,
    builder: (args) =>
      args
        .options(options)
        .options({
          cwd: {
            alias: 'C',
            nargs: 1,
            type: 'string',
            description: 'Run app-config in the context of this directory',
          },
        })
        .example(examples),
    async handler(args) {
      if (typeof args.cwd === 'string') process.chdir(args.cwd);
      await fn(args as any);
    },
  };
}

const secretsOption = {
  alias: 's',
  nargs: 0,
  type: 'boolean',
  default: false,
  description: 'Include secrets in the output',
} as const;

const prefixOption = {
  alias: 'p',
  type: 'string',
  default: 'APP_CONFIG',
  description: 'Prefix for environment variable names',
} as const;

const formatOption = {
  alias: 'f',
  nargs: 1,
  type: 'string',
  default: 'yaml' as string,
  choices: ['yaml', 'yml', 'json', 'json5', 'toml'],
} as const;

const selectOption = {
  nargs: 1,
  type: 'string',
  description: 'A JSON pointer to select a nested property in the object',
} as const;

function selectSecretsOrNot(config: Configuration, secrets: boolean): JsonObject {
  const { fullConfig, parsedNonSecrets } = config;

  if (secrets || !parsedNonSecrets) {
    return fullConfig;
  }

  return parsedNonSecrets.toJSON() as JsonObject;
}

function fileTypeForFormatOption(option: string): FileType {
  switch (option) {
    case 'json':
      return FileType.JSON;
    case 'json5':
      return FileType.JSON5;
    case 'toml':
      return FileType.TOML;
    case 'yml':
    case 'yaml':
    default:
      return FileType.YAML;
  }
}

const { argv: _ } = yargs
  .strict()
  .wrap(yargs.terminalWidth() - 5)
  .version()
  .help('h', 'Shows help message with examples and options')
  .alias('h', 'help')
  .command(
    subcommand(
      {
        name: ['vars', 'variables', 'v', 'env'],
        description: 'Prints out the generated environment variables',
        examples: [
          ['$0 vars --secrets > .env', 'Prints all environment variables, including secret values'],
          [
            'export $($0 vars | xargs -L 1)',
            'Export the generated environment variables to the current shell',
          ],
        ],
      },
      {
        secrets: secretsOption,
        prefix: prefixOption,
      },
      async (opts) => {
        const toPrint = selectSecretsOrNot(await loadConfig(), opts.secrets);

        process.stdout.write(
          Object.entries(flattenObjectTree(toPrint, opts.prefix))
            .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
            .join('\n'),
        );

        process.stdout.write('\n');
      },
    ),
  )
  .command(
    subcommand(
      {
        name: ['create', 'c'],
        description: 'Prints out the current configuration, in a file format',
        examples: [
          ['$0 --format json', 'Prints configuration in JSON format'],
          ['$0 --select "#/kubernetes"', 'Prints out a section of the configuration'],
        ],
      },
      {
        secrets: secretsOption,
        format: formatOption,
        select: selectOption,
      },
      async (opts) => {
        let toPrint: Json = selectSecretsOrNot(await loadConfig(), opts.secrets);

        if (opts.select) {
          toPrint = (await resolve(toPrint)).get(opts.select);
          if (toPrint === undefined) throw new Error(`Failed to select property ${opts.select}`);
        }

        process.stdout.write(stringify(toPrint, fileTypeForFormatOption(opts.format)));
        process.stdout.write('\n');
      },
    ),
  )
  .command(
    subcommand(
      {
        name: 'create-schema',
        description:
          'Prints the current schema object, in a file format, with all references resolves and flattened',
        examples: [
          ['$0 --format json', 'Prints out the schema in JSON format'],
          ['$0 --select "#/definitions/WebServer"', 'Prints out a specific section of the schema'],
        ],
      },
      {
        format: formatOption,
        select: selectOption,
      },
      async (opts) => {
        const { value: schema } = await loadSchema();

        let toPrint: Json = schema;

        if (opts.select) {
          toPrint = (await resolve(toPrint)).get(opts.select);
          if (toPrint === undefined) throw new Error(`Failed to select property ${opts.select}`);
        }

        process.stdout.write(stringify(toPrint, fileTypeForFormatOption(opts.format)));
        process.stdout.write('\n');
      },
    ),
  )
  .command({
    command: 'secret',
    aliases: ['secrets', 's'],
    describe: 'Encryption subcommands',
    handler: () => {},
    builder: (yargs) => yargs.demandCommand(),
  })
  .command(
    subcommand(
      {
        name: '*',
        description:
          'Runs a command, with some environment variables injected (APP_CONFIG_*). Allows accessing app-config without node.js.',
        examples: [
          [
            '$0 -- docker-compose up -d',
            'Run Docker Compose with the generated environment variables',
          ],
          ['$0 -- bash-script.sh', 'Run some script, that uses $APP_CONFIG_FOO variables'],
          ['$0 -- env', 'Print environment variables, with app-config variables injected'],
          // users are directed to these examples when just running app-config, so let's show some other subcommands
          ['$0 vars --secrets', 'Prints app config environment variables, including secret values'],
          ['$0 create -f json5', 'Prints app config as a format like YAML or JSON'],
          ['$0 generate', 'Run code generation as specified by the app-config file'],
        ],
      },
      {
        secrets: secretsOption,
        prefix: prefixOption,
        format: { ...formatOption, default: 'json' },
        select: selectOption,
      },
      async (opts) => {
        let toPrint: JsonObject = selectSecretsOrNot(await loadConfig(), opts.secrets);

        if (opts.select) {
          toPrint = (await resolve(toPrint)).get(opts.select) as JsonObject;
          if (toPrint === undefined) throw new Error(`Failed to select property ${opts.select}`);
        }

        const [command, ...args] = opts._;

        if (!command) {
          yargs.showHelp();
          process.exit(1);
        }

        await execa(command, args, {
          stdio: 'inherit',
          env: {
            [opts.prefix]: stringify(toPrint, fileTypeForFormatOption(opts.format), true),
            ...flattenObjectTree(toPrint, opts.prefix),
          },
        }).catch((err) => {
          if (err.exitCode) {
            console.error(`${err.message} - Exit code ${err.exitCode}`);
          } else {
            console.error(err.message);
          }

          if (err.exitCode) {
            process.exit(err.exitCode);
          }

          throw err;
        });
      },
    ),
  );
