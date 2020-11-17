#!/usr/bin/env node

import * as yargs from 'yargs';
import execa from 'execa';
import clipboardy from 'clipboardy';
import { outputFile, readFile } from 'fs-extra';
import { resolve, dereference } from 'json-schema-ref-parser';
import { stripIndents } from 'common-tags';
import { consumeStdin, flattenObjectTree, Json, JsonObject, promptUser } from './common';
import { FileType, stringify } from './config-source';
import { Configuration, loadConfig, loadValidatedConfig } from './config';
import {
  keyDirs,
  initializeLocalKeys,
  loadPublicKeyLazy,
  trustTeamMember,
  loadPrivateKeyLazy,
  loadLatestSymmetricKeyLazy,
  encryptValue,
  decryptValue,
  untrustTeamMember,
  loadKey,
  initializeKeys,
  deleteLocalKeys,
  generateSymmetricKey,
  loadSymmetricKeys,
  latestSymmetricKeyRevision,
  saveNewSymmetricKey,
  loadTeamMembersLazy,
} from './encryption';
import { shouldUseSecretAgent, startAgent, disconnectAgents } from './secret-agent';
import { loadSchema } from './schema';
import { generateTypeFiles } from './generate';
import { checkTTY, logger, LogLevel } from './logging';
import { AppConfigError, FailedToSelectSubObject, EmptyStdinOrPromptResponse } from './errors';

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

      await run(args as typeof args & yargs.InferredOptionTypes<Options & PositionalOptions>);

      // cleanup any secret agent clients right away, so it's safe to process.exit
      await disconnectAgents();

      process.exit(0);
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

const formatOption = {
  alias: 'f',
  type: 'string',
  default: 'yaml' as string,
  choices: ['yaml', 'yml', 'json', 'json5', 'toml'],
  group: OptionGroups.Options,
} as const;

const selectOption = {
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

function selectSecretsOrNot(config: Configuration, secrets: boolean): JsonObject {
  const { fullConfig, parsedNonSecrets } = config;

  if (secrets || !parsedNonSecrets) {
    return fullConfig as JsonObject;
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
      return FileType.YAML;
    default:
      throw new AppConfigError(`${option} is not a valid file type`);
  }
}

function loadConfigConditionalValidation(noSchema: boolean): typeof loadConfig {
  if (noSchema) return loadConfig;
  return loadValidatedConfig;
}

const { argv: _ } = yargs
  .strict()
  .wrap(yargs.terminalWidth() - 5)
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
          noSchema: noSchemaOption,
          agent: secretAgentOption,
        },
      },
      async (opts) => {
        shouldUseSecretAgent(opts.agent);

        const toPrint = selectSecretsOrNot(
          await loadConfigConditionalValidation(opts.noSchema)(),
          opts.secrets,
        );

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
          ['$0 create --format json', 'Prints configuration in JSON format'],
          ['$0 create --select "#/kubernetes"', 'Prints out a section of the configuration'],
        ],
        options: {
          secrets: secretsOption,
          format: formatOption,
          select: selectOption,
          noSchema: noSchemaOption,
          agent: secretAgentOption,
        },
      },
      async (opts) => {
        shouldUseSecretAgent(opts.agent);

        let toPrint = selectSecretsOrNot(
          await loadConfigConditionalValidation(opts.noSchema)(),
          opts.secrets,
        );

        if (opts.select) {
          toPrint = (await resolve(toPrint)).get(opts.select) as JsonObject;

          if (toPrint === undefined) {
            throw new FailedToSelectSubObject(`Failed to select property ${opts.select}`);
          }
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
        const { value: schema } = await loadSchema();

        let toPrint: Json;

        const normalized = await dereference(schema);
        const refs = await resolve(normalized);

        if (opts.select) {
          toPrint = refs.get(opts.select);

          if (toPrint === undefined) {
            throw new FailedToSelectSubObject(`Failed to select property ${opts.select}`);
          }
        } else {
          toPrint = refs.get('#');
        }

        process.stdout.write(stringify(toPrint, fileTypeForFormatOption(opts.format)));
        process.stdout.write('\n');
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
              },
            },
            async (opts) => {
              // load these right away, so user unlocks asap
              const privateKey = await loadPrivateKeyLazy();
              const key = await loadLatestSymmetricKeyLazy(privateKey);

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

              const encrypted = await encryptValue(secretValue, key);

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
          format: { ...formatOption, default: 'json' },
          select: selectOption,
          noSchema: noSchemaOption,
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

        let toPrint = selectSecretsOrNot(
          await loadConfigConditionalValidation(opts.noSchema)(),
          opts.secrets,
        );

        if (opts.select) {
          toPrint = (await resolve(toPrint)).get(opts.select) as JsonObject;

          if (toPrint === undefined) {
            throw new FailedToSelectSubObject(`Failed to select property ${opts.select}`);
          }
        }

        await execa(command, args, {
          stdio: 'inherit',
          env: {
            [opts.prefix]: stringify(toPrint, fileTypeForFormatOption(opts.format), true),
            ...flattenObjectTree(toPrint, opts.prefix),
          },
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
