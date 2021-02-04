#!/usr/bin/env node

import * as yargs from 'yargs';
import execa from 'execa';
import clipboardy from 'clipboardy';
import { outputFile, readFile } from 'fs-extra';
import { resolve } from 'json-schema-ref-parser';
import { stripIndents } from 'common-tags';
import {
  flattenObjectTree,
  renameInFlattenedTree,
  Json,
  JsonObject,
  FileType,
  stringify,
  checkTTY,
  logger,
  LogLevel,
  AppConfigError,
  FailedToSelectSubObject,
  EmptyStdinOrPromptResponse,
} from '@app-config/core';
import {
  LoadedConfiguration,
  ConfigLoadingOptions,
  loadUnvalidatedConfig,
  loadValidatedConfig,
  keyDirs,
  initializeLocalKeys,
  loadPrivateKeyLazy,
  loadPublicKeyLazy,
  encryptValue,
  decryptValue,
  loadKey,
  initializeKeys,
  deleteLocalKeys,
  loadSymmetricKeys,
  saveNewSymmetricKey,
  generateSymmetricKey,
  latestSymmetricKeyRevision,
  loadTeamMembersLazy,
  trustTeamMember,
  untrustTeamMember,
  shouldUseSecretAgent,
  startAgent,
  disconnectAgents,
  loadSchema,
  generateTypeFiles,
  validateAllConfigVariants,
  promptUser,
  consumeStdin,
  JSONSchema,
} from '@app-config/node';

enum OptionGroups {
  Options = 'Options:',
  General = 'General:',
  Logging = 'Logging:',
}

type SubcommandOptions<
  Options extends { [name: string]: yargs.Options },
  PositionalOptions extends { [name: string]: yargs.PositionalOptions }
> = {
  name: string | string[];
  description?: string;
  examples?: [string, string][];
  options?: Options;
  positional?: PositionalOptions;
};

type SubcommandFn<Options extends { [name: string]: yargs.Options }> = (
  args: yargs.InferredOptionTypes<Options> & { _: string[] },
) => Promise<void> | void;

function subcommand<
  Options extends { [name: string]: yargs.Options },
  PositionalOptions extends { [name: string]: yargs.PositionalOptions }
>(
  desc: SubcommandOptions<Options, PositionalOptions>,
  run: SubcommandFn<Options & PositionalOptions>,
): yargs.CommandModule {
  const { name, description, examples = [], options, positional } = desc;
  const [command, ...aliases] = Array.isArray(name) ? name : [name];

  return {
    command,
    aliases,
    describe: description,
    builder: (args) => {
      if (positional) {
        for (const [key, opt] of Object.entries(positional)) {
          args.positional(key, opt);
        }
      }

      if (options) {
        args.options(options);
      }

      args.example(examples);

      return args;
    },
    async handler(args) {
      if (typeof args.cwd === 'string') process.chdir(args.cwd);
      if (args.verbose) logger.setLevel(LogLevel.Verbose);
      if (args.quiet) logger.setLevel(LogLevel.Error);
      if (args.silent) logger.setLevel(LogLevel.None);

      await run(args as { _: string[] } & yargs.InferredOptionTypes<Options & PositionalOptions>);

      // cleanup any secret agent clients right away, so it's safe to exit
      await disconnectAgents();
    },
  };
}

const noSchemaOption = {
  alias: 'q',
  type: 'boolean',
  default: false,
  description: 'Avoids doing schema validation of your app-config (dangerous!)',
  group: OptionGroups.Options,
} as const;

const fileNameBaseOption = {
  type: 'string',
  description: 'Changes what file name prefix is used when looking for app-config files',
  group: OptionGroups.Options,
} as const;

const environmentOverrideOption = {
  type: 'string',
  description:
    'Explicitly overrides the current environment (set by APP_CONFIG_ENV | NODE_ENV | ENV)',
  group: OptionGroups.Options,
} as const;

const secretsOption = {
  alias: 's',
  type: 'boolean',
  default: false,
  description: 'Include secrets in the output',
  group: OptionGroups.Options,
} as const;

const prefixOption = {
  alias: 'p',
  type: 'string',
  default: 'APP_CONFIG',
  description: 'Prefix for environment variable names',
  group: OptionGroups.Options,
} as const;

const renameVariablesOption = {
  alias: 'r',
  type: 'string',
  array: true,
  description: 'Renames environment variables (eg. HTTP_PORT=FOO)',
  group: OptionGroups.Options,
} as const;

const aliasVariablesOption = {
  type: 'string',
  array: true,
  description: 'Like --rename, but keeps original name in results',
  group: OptionGroups.Options,
} as const;

const onlyVariablesOption = {
  type: 'string',
  array: true,
  description: 'Limits which environment variables are exported',
  group: OptionGroups.Options,
} as const;

const environmentVariableNameOption = {
  type: 'string',
  default: 'APP_CONFIG',
  description: 'Environment variable name to read full config from',
  group: OptionGroups.Options,
} as const;

const formatOption = {
  alias: 'f',
  type: 'string',
  default: 'yaml' as string,
  choices: ['yaml', 'yml', 'json', 'json5', 'toml', 'raw'],
  group: OptionGroups.Options,
} as const;

const selectOption = {
  alias: 'S',
  type: 'string',
  description: 'A JSON pointer to select a nested property in the object',
  group: OptionGroups.Options,
} as const;

const clipboardOption = {
  alias: 'c',
  type: 'boolean',
  description: 'Copies the value to the system clipboard',
  group: OptionGroups.Options,
} as const;

const secretAgentOption = {
  type: 'boolean',
  default: true,
  description: 'Uses the secret-agent, if available',
  group: OptionGroups.Options,
} as const;

interface LoadConfigCLIOptions {
  secrets?: boolean;
  select?: string;
  noSchema?: boolean;
  fileNameBase?: string;
  environmentOverride?: string;
  environmentVariableName?: string;
}

async function loadConfigWithOptions({
  secrets: includeSecrets,
  select,
  noSchema,
  fileNameBase,
  environmentOverride,
  environmentVariableName,
}: LoadConfigCLIOptions): Promise<[JsonObject, JSONSchema | undefined]> {
  const options: ConfigLoadingOptions = {
    fileNameBase,
    environmentOverride,
    environmentVariableName,
  };

  let loaded: LoadedConfiguration;
  if (noSchema) {
    loaded = await loadUnvalidatedConfig(options);
  } else {
    loaded = await loadValidatedConfig(options);
  }

  const { fullConfig, parsedNonSecrets, schema } = loaded;

  let jsonConfig: JsonObject;

  if (includeSecrets || !parsedNonSecrets) {
    jsonConfig = fullConfig as JsonObject;
  } else {
    jsonConfig = parsedNonSecrets.toJSON() as JsonObject;
  }

  if (select) {
    jsonConfig = (await resolve(jsonConfig)).get(select) as JsonObject;

    if (jsonConfig === undefined) {
      throw new FailedToSelectSubObject(`Failed to select property ${select}`);
    }
  }

  return [jsonConfig, schema];
}

async function loadVarsWithOptions({
  prefix,
  rename,
  alias,
  only,
  ...opts
}: LoadConfigCLIOptions & {
  prefix: string;
  rename?: string[];
  alias?: string[];
  only?: string[];
}): Promise<[ReturnType<typeof flattenObjectTree>, JsonObject, JSONSchema | undefined]> {
  const [config, schema] = await loadConfigWithOptions(opts);
  let flattened = flattenObjectTree(config, prefix);

  flattened = renameInFlattenedTree(flattened, rename, false);
  flattened = renameInFlattenedTree(flattened, alias, true);

  if (only) {
    const filtered: typeof flattened = {};

    for (const variable of Object.keys(flattened)) {
      if (only.includes(variable)) {
        filtered[variable] = flattened[variable];
      }
    }

    return [filtered, config, schema];
  }

  return [flattened, config, schema];
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
      return FileType.YAML;
    case 'raw':
      return FileType.RAW;
    default:
      throw new AppConfigError(`${option} is not a valid file type`);
  }
}

export const cli = yargs
  .scriptName('app-config')
  .wrap(Math.max(yargs.terminalWidth() - 5, 80))
  .strict()
  .version()
  .alias('v', 'version')
  .help('h', 'Show help message with examples and options')
  .alias('h', 'help')
  .options({
    cwd: {
      alias: 'C',
      nargs: 1,
      type: 'string',
      description: 'Run app-config in the context of this directory',
    },
  })
  .options({
    verbose: {
      type: 'boolean',
      description: 'Outputs verbose messages with internal details',
    },
    quiet: {
      type: 'boolean',
      description: 'Only outputs errors that user should be aware of',
    },
    silent: {
      type: 'boolean',
      description: 'Do not print anything non-functional',
    },
  })
  .group('cwd', OptionGroups.General)
  .group('help', OptionGroups.General)
  .group('version', OptionGroups.General)
  .group('verbose', OptionGroups.Logging)
  .group('quiet', OptionGroups.Logging)
  .group('silent', OptionGroups.Logging)
  .command(
    subcommand(
      {
        name: ['vars', 'variables', 'v'],
        description: 'Prints out the generated environment variables',
        examples: [
          ['$0 vars --secrets > .env', 'Prints all environment variables, including secret values'],
          [
            'export $($0 vars | xargs -L 1)',
            'Export the generated environment variables to the current shell',
          ],
        ],
        options: {
          secrets: secretsOption,
          prefix: prefixOption,
          rename: renameVariablesOption,
          alias: aliasVariablesOption,
          only: onlyVariablesOption,
          select: selectOption,
          noSchema: noSchemaOption,
          fileNameBase: fileNameBaseOption,
          environmentOverride: environmentOverrideOption,
          environmentVariableName: environmentVariableNameOption,
          agent: secretAgentOption,
        },
      },
      async (opts) => {
        shouldUseSecretAgent(opts.agent);

        const [env] = await loadVarsWithOptions(opts);

        process.stdout.write(
          Object.entries(env)
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
          ['$0 create --format json', 'Prints configuration in JSON format'],
          ['$0 create --select "#/kubernetes"', 'Prints out a section of the configuration'],
        ],
        options: {
          secrets: secretsOption,
          format: formatOption,
          select: selectOption,
          noSchema: noSchemaOption,
          fileNameBase: fileNameBaseOption,
          environmentOverride: environmentOverrideOption,
          environmentVariableName: environmentVariableNameOption,
          agent: secretAgentOption,
        },
      },
      async (opts) => {
        shouldUseSecretAgent(opts.agent);

        const [toPrint] = await loadConfigWithOptions(opts);

        process.stdout.write(stringify(toPrint, fileTypeForFormatOption(opts.format), true));
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
          ['$0 create-schema --format json', 'Prints out the schema in JSON format'],
          [
            '$0 create-schema --select "#/definitions/WebServer"',
            'Prints out a specific section of the schema',
          ],
        ],
        options: {
          format: formatOption,
          select: selectOption,
        },
      },
      async (opts) => {
        const { schema } = await loadSchema();

        let toPrint: Json;

        if (opts.select) {
          const refs = await resolve(schema);

          toPrint = refs.get(opts.select);

          if (toPrint === undefined) {
            throw new FailedToSelectSubObject(`Failed to select property ${opts.select}`);
          }
        } else {
          toPrint = schema as Json;
        }

        process.stdout.write(stringify(toPrint, fileTypeForFormatOption(opts.format), true));
        process.stdout.write('\n');
      },
    ),
  )
  .command(
    subcommand(
      {
        name: ['validate'],
        description: 'Checks all environment variants against your schema',
        options: {
          environment: {
            alias: 'env',
            type: 'string',
            description: 'Validates only using one environment',
            group: OptionGroups.Options,
          },
        },
      },
      async ({ environment }) => {
        if (environment) {
          await loadValidatedConfig({ environmentOverride: environment });
        } else {
          await validateAllConfigVariants();
        }
      },
    ),
  )
  .command(
    subcommand(
      {
        name: ['generate', 'gen', 'g'],
        description: 'Run code generation as specified by meta file',
      },
      async () => {
        const output = await generateTypeFiles();

        if (output.length === 0) {
          logger.warn('No files generated - did you add the correct meta properties?');
        } else {
          logger.info(`Generated: [ ${output.map(({ file }) => file).join(', ')} ]`);
        }
      },
    ),
  )
  .command({
    command: 'secrets',
    aliases: ['secret', 's'],
    describe: 'Encryption subcommands',
    handler: () => {},
    builder: (args) =>
      args
        .demandCommand()
        .command(
          subcommand(
            {
              name: 'init',
              description: 'Initializes your encryption keychain',
              examples: [['$0 secrets init', 'Sets up your machine-local encryption key']],
            },
            async () => {
              const initialized = await initializeLocalKeys();

              if (initialized === false) {
                throw new AppConfigError(
                  'Secrets were already initialized. Reset them if you want to create a new key.',
                );
              }

              process.stdout.write(`\nYour app-config key was set up in ${keyDirs.keychain}\n\n`);
              process.stdout.write(initialized.publicKeyArmored);
              process.stdout.write('\n');
            },
          ),
        )
        .command(
          subcommand(
            {
              name: 'init-repo',
              description:
                'Creates initial symmetric key and initializes team members for a repository',
              examples: [
                [
                  '$0 secrets init-repo',
                  'Creates properties in meta file, making you the first trusted user',
                ],
              ],
            },
            async () => {
              const myKey = await loadPublicKeyLazy();
              const privateKey = await loadPrivateKeyLazy();

              // we trust ourselves, essentially
              await trustTeamMember(myKey, privateKey);
              logger.info('Initialized team members and a symmetric key');
            },
          ),
        )
        .command(
          subcommand(
            {
              name: 'init-key',
              description: 'Creates a new symmetric key for encrypting new secrets',
              examples: [
                [
                  '$0 secrets init-key',
                  'Sets up a new symmetric key with the latest revision number',
                ],
              ],
            },
            async () => {
              const keys = await loadSymmetricKeys();
              const teamMembers = await loadTeamMembersLazy();

              let revision: number;

              if (keys.length > 0) {
                revision = latestSymmetricKeyRevision(keys) + 1;
              } else {
                revision = 1;
              }

              await saveNewSymmetricKey(await generateSymmetricKey(revision), teamMembers);
              logger.info(`Saved a new symmetric key, revision ${revision}`);
            },
          ),
        )
        .command(
          subcommand({ name: 'reset', description: 'Removes your encryption keys' }, async () => {
            const confirm = await promptUser({
              type: 'confirm',
              initial: false,
              message:
                "Are you sure? You won't be able to any decrypt secrets that were signed for you.",
            });

            if (confirm) {
              await deleteLocalKeys();
              logger.warn('Your keys are now removed.');
            }
          }),
        )
        .command(
          subcommand({ name: 'key', description: 'View your public key' }, async () => {
            process.stdout.write((await loadPublicKeyLazy()).armor());
          }),
        )
        .command(
          subcommand(
            {
              name: 'export <path>',
              description: 'Writes your public key to a file',
              examples: [
                [
                  '$0 secrets export /mnt/my-usb/joe-blow.asc',
                  'Writes your public key to a file, so it can be trusted by other users',
                ],
              ],
              positional: {
                path: {
                  type: 'string',
                  demandOption: true,
                  description: 'File to write key to',
                },
              },
            },
            async (opts) => {
              const key = await loadPublicKeyLazy();

              await outputFile(opts.path, key.armor());
              logger.info(`The file ${opts.path} was written with your public key`);
            },
          ),
        )
        .command(
          subcommand(
            {
              name: 'ci',
              description:
                'Creates an encryption key that can be used without a passphrase (useful for CI)',
            },
            async () => {
              logger.info('Creating a new trusted CI encryption key');

              const { privateKeyArmored, publicKeyArmored } = await initializeKeys(false);
              await trustTeamMember(await loadKey(publicKeyArmored), await loadPrivateKeyLazy());

              process.stdout.write(`\n${publicKeyArmored}\n\n${privateKeyArmored}\n\n`);

              process.stdout.write(
                stripIndents`
                  Public and private keys are printed above.
                  To use them, add CI variables called APP_CONFIG_SECRETS_KEY and APP_CONFIG_SECRETS_PUBLIC_KEY.
                  Ensure that (especially the private key) they are "protected" variables and not visible in logs.
                `,
              );
              process.stdout.write('\n');
            },
          ),
        )
        .command(
          subcommand(
            {
              name: 'trust <keyPath>',
              description: 'Adds a team member who can encrypt and decrypt values',
              examples: [
                [
                  '$0 secrets trust /mnt/my-usb/joe-blow.asc',
                  "Trusts a new team member's public key, allowing them to encrypt and decrypt values",
                ],
              ],
              positional: {
                keyPath: {
                  type: 'string',
                  demandOption: true,
                  description: 'Filepath of public key',
                },
              },
            },
            async (opts) => {
              const key = await loadKey(await readFile(opts.keyPath));
              const privateKey = await loadPrivateKeyLazy();
              await trustTeamMember(key, privateKey);

              logger.info(`Trusted ${key.getUserIds().join(', ')}`);
            },
          ),
        )
        .command(
          subcommand(
            {
              name: 'untrust <email>',
              description: 'Revokes encryption access (in future) for a trusted team member',
              examples: [
                [
                  '$0 secrets untrust joe.blow@example.com',
                  'Creates a new symmetric key for all future encryption',
                ],
              ],
              positional: {
                email: {
                  type: 'string',
                  demandOption: true,
                  description: 'User ID email address',
                },
              },
            },
            async (opts) => {
              const privateKey = await loadPrivateKeyLazy();
              await untrustTeamMember(opts.email, privateKey);
            },
          ),
        )
        .command(
          subcommand(
            {
              name: ['encrypt [secretValue]', 'enc [secretValue]', 'e [secretValue]'],
              description: 'Encrypts a secret value',
              examples: [
                ['$0 secrets encrypt "super-secret-value"', 'Encrypts the text given'],
                [`$0 secrets encrypt '{ "nested": { "object": true } }'`, 'Encrypts JSON value'],
              ],
              positional: {
                secretValue: {
                  type: 'string',
                  description: 'JSON value to encrypt',
                },
              },
              options: {
                clipboard: clipboardOption,
                agent: secretAgentOption,
              },
            },
            async (opts) => {
              shouldUseSecretAgent(opts.agent);

              // load these right away, so user unlocks asap
              if (!shouldUseSecretAgent()) await loadPrivateKeyLazy();

              let { secretValue }: { secretValue?: Json } = opts;

              if (!secretValue) {
                if (checkTTY()) {
                  secretValue = await promptUser({
                    type: 'password',
                    message: 'Value to encrypt (can be JSON)',
                  });
                } else {
                  secretValue = await consumeStdin();
                }
              }

              if (!secretValue) {
                throw new EmptyStdinOrPromptResponse('Failed to read from stdin or prompt');
              }

              if (typeof secretValue === 'string') {
                const isJson = secretValue.startsWith('{') && secretValue.endsWith('}');

                try {
                  secretValue = JSON.parse(secretValue) as Json;
                } catch (err) {
                  if (isJson) throw err;
                  // only complain if it's definitely supposed to be JSON
                }
              }

              const encrypted = await encryptValue(secretValue);

              if (opts.clipboard) {
                await clipboardy.write(encrypted);
                process.stderr.write('Wrote encrypted text to system clipboard\n');
              }

              process.stdout.write(encrypted);
              process.stdout.write('\n');
            },
          ),
        )
        .command(
          subcommand(
            {
              name: ['decrypt [encryptedText]', 'dec [encryptedText]', 'd [encryptedText]'],
              description: 'Decrypts a secret value',
              examples: [],
              positional: {
                encryptedText: {
                  type: 'string',
                  description: 'JSON value to encrypt',
                  group: OptionGroups.Options,
                },
              },
              options: {
                clipboard: clipboardOption,
                agent: secretAgentOption,
              },
            },
            async (opts) => {
              shouldUseSecretAgent(opts.agent);

              // load these right away, so user unlocks asap
              if (!shouldUseSecretAgent()) await loadPrivateKeyLazy();

              let { encryptedText } = opts;

              if (!encryptedText && opts.clipboard) {
                encryptedText = await clipboardy.read();
                if (encryptedText) process.stderr.write('Read value from system clipboard\n');
              }

              if (!encryptedText) {
                if (checkTTY()) {
                  encryptedText = await promptUser({
                    type: 'password',
                    message: 'Value to decrypt',
                  });
                } else {
                  encryptedText = await consumeStdin();
                }
              }

              if (!encryptedText) {
                throw new EmptyStdinOrPromptResponse('Failed to read from stdin or prompt');
              }

              process.stdout.write(JSON.stringify(await decryptValue(encryptedText)));
              process.stdout.write('\n');
            },
          ),
        )
        .command(
          subcommand(
            {
              name: 'agent',
              description: 'Starts the secret-agent daemon',
            },
            async () => {
              await startAgent();

              // wait forever
              await new Promise(() => {});
            },
          ),
        ),
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
          ['$0 generate', 'Run code generation as specified by the app-config meta file'],
        ],
        options: {
          secrets: secretsOption,
          prefix: prefixOption,
          rename: renameVariablesOption,
          alias: aliasVariablesOption,
          only: onlyVariablesOption,
          format: { ...formatOption, default: 'json' },
          select: selectOption,
          noSchema: noSchemaOption,
          fileNameBase: fileNameBaseOption,
          environmentOverride: environmentOverrideOption,
          environmentVariableName: environmentVariableNameOption,
          agent: secretAgentOption,
        },
      },
      async (opts) => {
        shouldUseSecretAgent(opts.agent);

        const [command, ...args] = opts._;

        if (!command) {
          yargs.showHelp();
          process.exit(1);
        }

        const [env, fullConfig, schema] = await loadVarsWithOptions(opts);

        // if prefix is set to something non-zero, set it as the full config
        if (opts.prefix.length > 0) {
          // this is almost always just APP_CONFIG
          const variableName = opts.prefix;

          // if we specified --only FOO, don't include APP_CONFIG
          if (!opts.only || opts.only.includes(variableName)) {
            env[variableName] = stringify(fullConfig, fileTypeForFormatOption(opts.format), true);
          }

          // this is APP_CONFIG_SCHEMA, a special variable used by programs to do their own validation
          const schemaVariableName = `${variableName}_SCHEMA`;

          if (schema && (!opts.only || opts.only.includes(schemaVariableName))) {
            env[schemaVariableName] = stringify(
              schema as Json,
              fileTypeForFormatOption(opts.format),
              true,
            );
          }
        }

        await execa(command, args, {
          stdio: 'inherit',
          env,
        }).catch((err) => {
          logger.error(err.message);

          if (err.exitCode) {
            process.exit(err.exitCode);
          }

          return Promise.reject(err);
        });
      },
    ),
  );

if (require.main === module) {
  cli.parse();
}
