#!/usr/bin/env node

import * as execa from 'execa';
import * as Yargs from 'yargs';
import * as refParser from 'json-schema-ref-parser';
import * as PrettyError from 'pretty-error';
import * as prompts from 'prompts';
import { stripIndent } from 'common-tags';
import { pathExists, readFile, outputFile } from 'fs-extra';
import { flattenObjectTree } from './util';
import { loadConfigRaw, LoadedConfig, ConfigSource } from './config';
import { loadValidated, loadSchema } from './schema';
import { generateTypeFiles } from './generate';
import { stringify, extToFileType } from './file-loader';
import {
  initializeKeys,
  initializeLocalKeys,
  loadPublicKeyLazy,
  loadKey,
  resetKeys,
  encryptValue,
  decryptText,
  trustTeamMember,
  untrustTeamMember,
  createSymmetricKey,
  saveSymmetricKey,
  dirs as keyDirs,
} from './secrets';

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
  .command<BaseArgs>({
    command: 'secret',
    aliases: ['s'],
    describe: 'Encryption subcommands',
    handler() {},
    builder: yargs =>
      yargs
        .demand(1, 'Secret requires a subcommand')
        .command<BaseArgs>({
          command: 'init',
          describe: 'Initializes your secret keychain',
          async handler() {
            const initialized = await initializeLocalKeys();

            if (initialized === false) {
              console.log('Secrets were already initialized');
              process.exit(1);
            } else {
              console.log(`Your app-config key was set up in ${keyDirs.keychain}`);

              console.log();
              console.log(initialized.publicKeyArmored);
            }
          },
        })
        .command<BaseArgs>({
          command: 'init-repo',
          describe: 'Creates initial team members and symmetric key',
          async handler() {
            const myKey = await loadPublicKeyLazy();

            await trustTeamMember(myKey.armor());
            console.log('Initialized team members and a symmetric key');
          },
        })
        .command<BaseArgs>({
          command: 'init-key',
          describe: 'Creates a new symmetric key, for any new secrets',
          async handler() {
            const { revision } = await saveSymmetricKey(await createSymmetricKey());

            console.log(`A new symmetric key ${revision} was added to the repository.`);
          },
        })
        .command<BaseArgs>({
          command: 'reset',
          describe: 'Removes your secrets key',
          async handler() {
            const { confirm } = await prompts({
              name: 'confirm',
              type: 'confirm',
              message: 'Are you sure? You wont be able to decrypt secrets that were signed for you',
              initial: true,
            });

            if (confirm) {
              await resetKeys();
              console.log('Your keys are removed');
            }
          },
        })
        .command<BaseArgs>({
          command: 'key',
          describe: 'View your public key',
          async handler() {
            const key = await loadPublicKeyLazy();

            console.log(key.armor());
          },
        })
        .command<BaseArgs & { path: string }>({
          command: 'export [path]',
          describe: 'Writes your public key to a file',
          async handler({ path }) {
            const key = await loadPublicKeyLazy();

            await outputFile(path, key.armor());
          },
        })
        .command<BaseArgs>({
          command: 'ci',
          describe: 'Initializes a trusted key for CI',
          async handler() {
            const { privateKeyArmored, publicKeyArmored } = await initializeKeys(false);

            await trustTeamMember(publicKeyArmored);

            console.log();
            console.log(publicKeyArmored);
            console.log();
            console.log(privateKeyArmored);
            console.log();

            console.log('Public and private keys are printed above.');
            console.log(
              'To use them, add CI variables called APP_CONFIG_SECRETS_KEY and APP_CONFIG_SECRETS_PUBLIC_KEY.',
            );
          },
        })
        .command<BaseArgs & { keyPath: string }>({
          command: 'trust [keyPath]',
          describe: 'Trusts a person, via their public key',
          async handler({ keyPath }) {
            const key = await loadKey(await readFile(keyPath));

            await trustTeamMember(key.armor());

            console.log(`Trusted ${key.getUserIds().join(', ')}`);
          },
        })
        .command<BaseArgs & { email: string }>({
          command: 'untrust [email]',
          describe: 'Revokes trust for a team member',
          async handler({ email }) {
            await untrustTeamMember(email);
          },
        })
        .command<BaseArgs & { secretValue: string }>({
          command: 'encrypt [secretValue]',
          describe: 'Encrypt a secret',
          async handler(argv) {
            try {
              console.log(await encryptValue(JSON.parse(argv.secretValue)));
            } catch {
              console.log(await encryptValue(argv.secretValue));
            }
          },
        })
        .command<BaseArgs & { secretText: string }>({
          command: 'decrypt [secretText]',
          describe: 'Decrypt a secret',
          async handler(argv) {
            console.log(await decryptText(argv.secretText));
          },
        }),
  })
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

      await loadConfigRaw()
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
