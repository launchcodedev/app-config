import { join, resolve } from 'path';
import * as fs from 'fs-extra';
import * as pgp from 'openpgp';
import { inspect } from 'util';
import { generateKey, encrypt, decrypt, message, crypto } from 'openpgp';
import { oneLine } from 'common-tags';
import {
  stringify,
  FileType,
  AppConfigError,
  EmptyStdinOrPromptResponse,
  InvalidEncryptionKey,
  EncryptionEncoding,
  SecretsRequireTTYError,
} from '@app-config/core';
import { Json } from '@app-config/utils';
import { checkTTY, logger } from '@app-config/logging';
import {
  aliasesFor,
  currentEnvironment,
  EnvironmentOptions,
  promptUser,
  promptUserWithRetry,
} from '@app-config/node';
import {
  loadMetaConfig,
  loadMetaConfigLazy,
  MetaProperties,
  EncryptedSymmetricKey,
} from '@app-config/meta';
import { settingsDirectory } from '@app-config/settings';
import { connectAgentLazy, shouldUseSecretAgent } from './secret-agent';

export type Key = pgp.key.Key & { keyName?: string };

export const keyDirs = {
  get keychain() {
    if (process.env.APP_CONFIG_SECRETS_KEYCHAIN_FOLDER) {
      return resolve(process.env.APP_CONFIG_SECRETS_KEYCHAIN_FOLDER);
    }

    return join(settingsDirectory(), 'keychain');
  },
  get privateKey() {
    return join(keyDirs.keychain, 'private-key.asc');
  },
  get publicKey() {
    return join(keyDirs.keychain, 'public-key.asc');
  },
  get revocationCert() {
    return join(keyDirs.keychain, 'revocation.asc');
  },
};

interface UserKeys {
  privateKeyArmored: string;
  publicKeyArmored: string;
  revocationCertificate: string;
}

export async function initializeKeysManually(options: {
  name: string;
  email: string;
  passphrase?: string;
}): Promise<UserKeys> {
  const { name, email, passphrase } = options;

  if (passphrase) {
    logger.verbose(`Initializing a key with passphrase for ${email}`);
  } else {
    logger.verbose(`Initializing a key without a passphrase for ${email}`);
  }

  const { privateKeyArmored, publicKeyArmored, revocationCertificate } = await generateKey({
    curve: 'ed25519',
    userIds: [{ name, email }],
    passphrase,
  });

  return {
    privateKeyArmored,
    publicKeyArmored,
    revocationCertificate,
  };
}

export async function initializeKeys(withPassphrase: boolean = true): Promise<UserKeys> {
  if (!checkTTY()) throw new SecretsRequireTTYError();

  const name = await promptUser<string>({ message: 'Name', type: 'text' });
  const email = await promptUser<string>({ message: 'Email', type: 'text' });

  let passphrase;

  if (withPassphrase) {
    passphrase = await promptUser<string>({ message: 'Passphrase', type: 'password' });
  }

  if (!name) throw new EmptyStdinOrPromptResponse('No name given');
  if (!email) throw new EmptyStdinOrPromptResponse('No email given');
  if (withPassphrase && !passphrase) throw new EmptyStdinOrPromptResponse('No passphrase given');

  return initializeKeysManually({ name, email, passphrase });
}

export async function initializeLocalKeys(keys?: UserKeys, dirs: typeof keyDirs = keyDirs) {
  if (await fs.pathExists(dirs.keychain)) {
    return false;
  }

  logger.info('Initializing your encryption keys');

  const { privateKeyArmored, publicKeyArmored, revocationCertificate } =
    keys ?? (await initializeKeys());

  const prevUmask = process.umask(0o077);

  try {
    await fs.mkdirp(dirs.keychain);

    process.umask(0o177);

    await Promise.all([
      fs.writeFile(dirs.privateKey, privateKeyArmored),
      fs.writeFile(dirs.publicKey, publicKeyArmored),
      fs.writeFile(dirs.revocationCert, revocationCertificate),
    ]);

    logger.info(`Wrote your encryption keys in ${dirs.keychain}`);
  } finally {
    process.umask(prevUmask);
  }

  return { publicKeyArmored };
}

export async function deleteLocalKeys(dirs: typeof keyDirs = keyDirs) {
  await fs.remove(dirs.keychain);
}

export async function loadKey(contents: string | Buffer): Promise<Key> {
  const { err, keys } = await pgp.key.readArmored(contents);

  if (err) throw err[0];

  return keys[0];
}

export async function loadPrivateKey(
  override: string | Buffer | undefined = process.env.APP_CONFIG_SECRETS_KEY,
): Promise<Key> {
  let key: Key;

  if (override) {
    key = await loadKey(override);
  } else {
    if (process.env.CI) {
      logger.info('Warning! Trying to load encryption keys from home folder in a CI environment');
    }

    key = await loadKey(await fs.readFile(keyDirs.privateKey));
  }

  if (!key.isPrivate()) {
    throw new InvalidEncryptionKey('Tried to load a public key as a private key');
  }

  if (!key.isDecrypted()) {
    if (!checkTTY()) throw new SecretsRequireTTYError();

    await promptUserWithRetry<string>(
      { message: 'Your Passphrase', type: 'password' },
      async (passphrase) => {
        return key.decrypt(passphrase).then(
          () => true,
          (error: Error) => error,
        );
      },
    );
  }

  return key;
}

export async function loadPublicKey(
  override: string | Buffer | undefined = process.env.APP_CONFIG_SECRETS_PUBLIC_KEY,
): Promise<Key> {
  let key: Key;

  if (override) {
    key = await loadKey(override);
  } else {
    if (process.env.CI) {
      logger.warn('Warning! Trying to load encryption keys from home folder in a CI environment');
    }

    key = await loadKey(await fs.readFile(keyDirs.publicKey));
  }

  if (key.isPrivate())
    throw new InvalidEncryptionKey('Tried to load a private key as a public key');

  return key;
}

let loadedPrivateKey: Promise<Key> | undefined;

export async function loadPrivateKeyLazy(): Promise<Key> {
  if (!loadedPrivateKey) {
    logger.verbose('Loading local private key');

    if (checkTTY()) {
      // help the end user, if they haven't initialized their local keys yet
      loadedPrivateKey = initializeLocalKeys().then(() => loadPrivateKey());
    } else {
      loadedPrivateKey = loadPrivateKey();
    }
  }

  return loadedPrivateKey;
}

let loadedPublicKey: Promise<Key> | undefined;

export async function loadPublicKeyLazy(): Promise<Key> {
  if (!loadedPublicKey) {
    logger.verbose('Loading local public key');

    if (checkTTY()) {
      // help the end user, if they haven't initialized their local keys yet
      loadedPublicKey = initializeLocalKeys().then(() => loadPublicKey());
    } else {
      loadedPublicKey = loadPublicKey();
    }
  }

  return loadedPublicKey;
}

export { EncryptedSymmetricKey };

export interface DecryptedSymmetricKey {
  revision: number;
  key: Uint8Array;
}

export async function generateSymmetricKey(revision: number): Promise<DecryptedSymmetricKey> {
  // eslint-disable-next-line @typescript-eslint/await-thenable
  const rawPassword = await crypto.random.getRandomBytes(2048);
  const passwordWithRevision = encodeRevisionInPassword(rawPassword, revision);

  return { revision, key: passwordWithRevision };
}

export async function encryptSymmetricKey(
  decrypted: DecryptedSymmetricKey,
  teamMembers: Key[],
): Promise<EncryptedSymmetricKey> {
  if (teamMembers.length === 0) {
    throw new AppConfigError('Cannot create a symmetric key with no teamMembers');
  }

  const { data: key } = await encrypt({
    message: message.fromBinary(decrypted.key),
    publicKeys: [...teamMembers],
  });

  return { revision: decrypted.revision, key };
}

export async function decryptSymmetricKey(
  encrypted: EncryptedSymmetricKey,
  privateKey: Key,
): Promise<DecryptedSymmetricKey> {
  const decrypted = await decrypt({
    format: 'binary',
    message: await message.readArmored(encrypted.key),
    privateKeys: [privateKey],
  });

  const { data } = decrypted as { data: Uint8Array };
  verifyEncodedRevision(data, encrypted.revision);

  return { revision: encrypted.revision, key: data };
}

export async function saveNewSymmetricKey(
  symmetricKey: DecryptedSymmetricKey,
  teamMembers: Key[],
  environmentOptions?: EnvironmentOptions,
) {
  const encrypted = await encryptSymmetricKey(symmetricKey, teamMembers);

  await saveNewMetaFile(({ encryptionKeys = [], ...meta }) => ({
    ...meta,
    encryptionKeys: addForEnvironment(encrypted, encryptionKeys, environmentOptions),
  }));
}

export async function loadSymmetricKeys(
  lazy = true,
  environmentOptions?: EnvironmentOptions,
): Promise<EncryptedSymmetricKey[]> {
  // flag is here mostly for testing
  const loadMeta = lazy ? loadMetaConfigLazy : loadMetaConfig;
  const environment = currentEnvironment(environmentOptions);

  const {
    value: { encryptionKeys = [] },
  } = await loadMeta();

  const selected = selectForEnvironment(encryptionKeys, environmentOptions);

  logger.verbose(
    `Found ${selected.length} symmetric keys for environment: ${environment ?? 'none'}`,
  );

  return selected;
}

export async function loadSymmetricKey(
  revision: number,
  privateKey: Key,
  lazyMeta = true,
  environmentOptions?: EnvironmentOptions,
): Promise<DecryptedSymmetricKey> {
  const symmetricKeys = await loadSymmetricKeys(lazyMeta, environmentOptions);
  const symmetricKey = symmetricKeys.find((k) => k.revision === revision);

  if (!symmetricKey) throw new InvalidEncryptionKey(`Could not find symmetric key ${revision}`);

  logger.verbose(`Loading symmetric key r${symmetricKey.revision}`);

  return decryptSymmetricKey(symmetricKey, privateKey);
}

const symmetricKeys = new Map<number, Promise<DecryptedSymmetricKey>>();

export async function loadSymmetricKeyLazy(
  revision: number,
  privateKey: Key,
  environmentOptions?: EnvironmentOptions,
): Promise<DecryptedSymmetricKey> {
  if (!symmetricKeys.has(revision)) {
    symmetricKeys.set(revision, loadSymmetricKey(revision, privateKey, true, environmentOptions));
  }

  return symmetricKeys.get(revision)!;
}

export async function loadLatestSymmetricKey(
  privateKey: Key,
  environmentOptions?: EnvironmentOptions,
): Promise<DecryptedSymmetricKey> {
  const allKeys = await loadSymmetricKeys(false, environmentOptions);

  return loadSymmetricKey(
    latestSymmetricKeyRevision(allKeys),
    privateKey,
    false,
    environmentOptions,
  );
}

export async function loadLatestSymmetricKeyLazy(
  privateKey: Key,
  environmentOptions?: EnvironmentOptions,
): Promise<DecryptedSymmetricKey> {
  const allKeys = await loadSymmetricKeys(true, environmentOptions);

  return loadSymmetricKeyLazy(latestSymmetricKeyRevision(allKeys), privateKey, environmentOptions);
}

export async function encryptValue(
  value: Json,
  symmetricKeyOverride?: DecryptedSymmetricKey,
  environmentOptions?: EnvironmentOptions,
): Promise<string> {
  if (!symmetricKeyOverride && shouldUseSecretAgent()) {
    const client = await retrieveSecretAgent(environmentOptions);

    if (client) {
      const allKeys = await loadSymmetricKeys(true, environmentOptions);
      const latestRevision = latestSymmetricKeyRevision(allKeys);
      const symmetricKey = allKeys.find((k) => k.revision === latestRevision)!;

      return client.encryptValue(value, symmetricKey);
    }
  }

  let symmetricKey: DecryptedSymmetricKey;

  if (symmetricKeyOverride) {
    symmetricKey = symmetricKeyOverride;
  } else {
    symmetricKey = await loadLatestSymmetricKeyLazy(await loadPrivateKeyLazy(), environmentOptions);
  }

  // all encrypted data is JSON encoded
  const text = JSON.stringify(value);

  const { data } = await encrypt({
    message: message.fromText(text),
    passwords: [symmetricKey.key],
  });

  // we take out the base64 encoded portion, so that secrets are nice and short, easy to copy-paste
  const base64Regex = /\r\n\r\n((?:\S+\r\n)+)-----END PGP MESSAGE-----/g;
  const extracted = base64Regex.exec(data.toString());

  if (!extracted) {
    throw new EncryptionEncoding('Invalid message was formed in encryption');
  }

  const base64 = extracted[1].split('\r\n').join('');

  return `enc:${symmetricKey.revision}:${base64}`;
}

export async function decryptValue(
  text: string,
  symmetricKeyOverride?: DecryptedSymmetricKey,
  environmentOptions?: EnvironmentOptions,
): Promise<Json> {
  if (!symmetricKeyOverride && shouldUseSecretAgent()) {
    const client = await retrieveSecretAgent(environmentOptions);

    if (client) {
      return client.decryptValue(text);
    }
  }

  const [, revision, base64] = text.split(':');

  let symmetricKey: DecryptedSymmetricKey;

  if (symmetricKeyOverride) {
    symmetricKey = symmetricKeyOverride;
  } else {
    const revisionNumber = parseFloat(revision);

    if (Number.isNaN(revisionNumber)) {
      throw new AppConfigError(
        `Encrypted value was invalid, revision was not a number (${revision})`,
      );
    }

    symmetricKey = await loadSymmetricKeyLazy(
      revisionNumber,
      await loadPrivateKeyLazy(),
      environmentOptions,
    );
  }

  const armored = `-----BEGIN PGP MESSAGE-----\nVersion: OpenPGP.js VERSION\n\n${base64}\n-----END PGP PUBLIC KEY BLOCK-----`;

  const decrypted = await decrypt({
    format: 'utf8',
    message: await message.readArmored(armored),
    passwords: [symmetricKey.key as any], // openpgp does accept non-string passwords, ts is wrong
  });

  const { data } = decrypted as { data: string };

  if (!data || data.length === 0) {
    throw new EncryptionEncoding('Data in decryption returned back a zero-length string');
  }

  // all encrypted data is JSON encoded
  return JSON.parse(data) as Json;
}

export async function loadTeamMembers(environmentOptions?: EnvironmentOptions): Promise<Key[]> {
  const environment = currentEnvironment(environmentOptions);
  const {
    value: { teamMembers = [] },
  } = await loadMetaConfig();

  const currentTeamMembers = selectForEnvironment(teamMembers, environmentOptions);

  logger.verbose(
    `Found ${currentTeamMembers.length} team members for environment: ${environment ?? 'none'}`,
  );

  return Promise.all(
    currentTeamMembers.map(({ keyName, publicKey }) =>
      loadKey(publicKey).then((key) => Object.assign(key, { keyName })),
    ),
  );
}

let loadedTeamMembers: Promise<Key[]> | undefined;

export async function loadTeamMembersLazy(environmentOptions?: EnvironmentOptions): Promise<Key[]> {
  if (!loadedTeamMembers) {
    loadedTeamMembers = loadTeamMembers(environmentOptions);
  }

  return loadedTeamMembers;
}

export async function trustTeamMember(
  newTeamMember: Key,
  privateKey: Key,
  environmentOptions?: EnvironmentOptions,
) {
  const teamMembers = await loadTeamMembers(environmentOptions);

  if (newTeamMember.isPrivate()) {
    throw new InvalidEncryptionKey(
      'A private key was passed in as a team member. Only public keys should be in team members.',
    );
  }

  const newUserId = newTeamMember.getUserIds().join('');
  const foundDuplicate = teamMembers.find((k) => k.getUserIds().join('') === newUserId);

  if (foundDuplicate) {
    const userIds = foundDuplicate.getUserIds().join(', ');

    logger.warn(`The team member '${userIds}' was already trusted. Adding anyways.`);
  }

  const newTeamMembers = teamMembers.concat(newTeamMember);

  const newEncryptionKeys = await reencryptSymmetricKeys(
    await loadSymmetricKeys(true, environmentOptions),
    newTeamMembers,
    privateKey,
  );

  await saveNewMetaFile((meta) => ({
    ...meta,
    teamMembers: newTeamMembers.map((key) => ({
      userId: key.getUserIds()[0],
      keyName: key.keyName ?? null,
      publicKey: key.armor(),
    })),
    encryptionKeys: addForEnvironment(
      newEncryptionKeys,
      meta.encryptionKeys ?? [],
      environmentOptions,
      true,
    ),
  }));
}

export async function untrustTeamMember(
  email: string,
  privateKey: Key,
  environmentOptions?: EnvironmentOptions,
) {
  const teamMembers = await loadTeamMembers(environmentOptions);

  const removalCandidates = new Set<Key>();

  for (const teamMember of teamMembers) {
    if (teamMember.getUserIds().some((u) => u.includes(`<${email}>`))) {
      removalCandidates.add(teamMember);
    }
  }

  let removeTeamMembers: Key[];

  if (removalCandidates.size > 1) {
    removeTeamMembers = await promptUser<Key[]>({
      type: 'multiselect',
      message: 'Which team members should be untrusted?',
      hint: '- Space to select. Enter to submit.',
      instructions: false,
      choices: Array.from(removalCandidates).map((teamMember) => ({
        title: teamMember.keyName ? `${email} (${teamMember.keyName})` : email,
        value: teamMember,
      })),
    });
  } else {
    removeTeamMembers = Array.from(removalCandidates);
  }

  for (const teamMember of removeTeamMembers) {
    logger.warn(`Removing trust from ${teamMember.getUserIds().join(', ')}`);
  }

  const newTeamMembers = teamMembers.filter(
    (teamMember) => !removeTeamMembers.includes(teamMember),
  );

  if (newTeamMembers.length === teamMembers.length) {
    throw new AppConfigError(`There were no team members with the email ${email}`);
  }

  if (newTeamMembers.length === 0) {
    throw new AppConfigError(
      'You cannot remove the last team member, since there would be no one to trust',
    );
  }

  // re-encrypt symmetric keys without the team member
  // this isn't actually secure on its own, which is why we create a new one
  // we do this solely to make it harder to go back in time and get old secrets
  // of course, nothing stops users from having previously copy-pasted secrets, so they should always be rotated when untrusting old users
  // reason being, they had previous access to the actual private symmetric key
  const newEncryptionKeys = await reencryptSymmetricKeys(
    await loadSymmetricKeys(true, environmentOptions),
    newTeamMembers,
    privateKey,
  );

  const newLatestEncryptionKey = await encryptSymmetricKey(
    await generateSymmetricKey(latestSymmetricKeyRevision(newEncryptionKeys) + 1),
    newTeamMembers,
  );

  newEncryptionKeys.push(newLatestEncryptionKey);

  await saveNewMetaFile((meta) => ({
    ...meta,
    teamMembers: newTeamMembers.map((key) => ({
      userId: key.getUserIds()[0],
      keyName: key.keyName ?? null,
      publicKey: key.armor(),
    })),
    encryptionKeys: addForEnvironment(
      newEncryptionKeys,
      meta.encryptionKeys ?? [],
      environmentOptions,
      true,
    ),
  }));
}

export function latestSymmetricKeyRevision(
  keys: (EncryptedSymmetricKey | DecryptedSymmetricKey)[],
): number {
  keys.sort((a, b) => a.revision - b.revision);

  if (keys.length === 0) throw new InvalidEncryptionKey('No symmetric keys were found');

  return keys[keys.length - 1].revision;
}

async function reencryptSymmetricKeys(
  previousSymmetricKeys: EncryptedSymmetricKey[],
  newTeamMembers: Key[],
  privateKey: Key,
): Promise<EncryptedSymmetricKey[]> {
  const newEncryptionKeys: EncryptedSymmetricKey[] = [];

  if (previousSymmetricKeys.length === 0) {
    const initialKey = await generateSymmetricKey(1);
    const encrypted = await encryptSymmetricKey(initialKey, newTeamMembers);

    newEncryptionKeys.push(encrypted);
  } else {
    for (const symmetricKey of previousSymmetricKeys) {
      // re-encrypt every key using the new team members list
      const decrypted = await decryptSymmetricKey(symmetricKey, privateKey);
      const encrypted = await encryptSymmetricKey(decrypted, newTeamMembers);

      newEncryptionKeys.push(encrypted);
    }
  }

  return newEncryptionKeys;
}

async function retrieveSecretAgent(environmentOptions?: EnvironmentOptions) {
  let client;

  try {
    client = await connectAgentLazy(undefined, undefined, environmentOptions);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'error' in err) {
      const { error } = err as { error: { errno: string } };

      if (error.errno === 'ECONNREFUSED') {
        logger.warn('Secret agent is not running');
      }

      logger.verbose(`Secret agent connect error: ${inspect(error)}`);
    } else {
      logger.error(`Secret agent connect error: ${inspect(err)}`);
    }
  }

  return client;
}

async function saveNewMetaFile(mutate: (props: MetaProperties) => MetaProperties) {
  const { value: oldMeta, filePath, fileType } = await loadMetaConfig();

  const writeMeta = mutate(oldMeta) as Json;
  const writeFilePath = filePath ?? '.app-config.meta.yml';
  const writeFileType = fileType ?? FileType.YAML;

  logger.info(`Writing ${writeFilePath} file with new encryption properties`);
  await fs.writeFile(writeFilePath, stringify(writeMeta, writeFileType));
}

function selectForEnvironment<T>(
  values: T[] | Record<string, T[]>,
  environmentOptions: EnvironmentOptions | undefined,
): T[] {
  if (Array.isArray(values)) {
    return values;
  }

  const environment = currentEnvironment(environmentOptions);

  if (environment === undefined) {
    if ('none' in values) {
      return values.none;
    }

    if ('default' in values) {
      return values.default;
    }

    const environments = Array.from(Object.keys(values).values()).join(', ');

    throw new AppConfigError(`No current environment selected, found [${environments}}`);
  }

  if (environment in values) {
    return values[environment];
  }

  if (environmentOptions?.aliases) {
    for (const alias of aliasesFor(environment, environmentOptions.aliases)) {
      if (alias in values) {
        return values[alias];
      }
    }
  }

  const environments = Array.from(Object.keys(values).values()).join(', ');

  throw new AppConfigError(
    `Current environment was ${environment}, only found [${environments}] when selecting environment-specific encryption options from meta file`,
  );
}

function addForEnvironment<T>(
  add: T | T[],
  values: T[] | Record<string, T[]>,
  environmentOptions: EnvironmentOptions | undefined,
  overwrite = false,
): T[] | Record<string, T[]> {
  const addArray = Array.isArray(add) ? add : [add];
  const addOrReplace = (orig: T[]) => {
    if (overwrite) {
      return addArray;
    }

    return orig.concat(addArray);
  };

  if (Array.isArray(values)) {
    return values.concat(add);
  }

  const environment = currentEnvironment(environmentOptions);

  if (environment === undefined) {
    if ('none' in values) {
      return {
        ...values,
        none: addOrReplace(values.none),
      };
    }

    if ('default' in values) {
      return {
        ...values,
        default: addOrReplace(values.default),
      };
    }

    const environments = Array.from(Object.keys(values).values()).join(', ');

    throw new AppConfigError(
      `No current environment selected, found [${environments}] when adding environment-specific encryption options to meta file`,
    );
  }

  if (environment in values) {
    return {
      ...values,
      [environment]: addOrReplace(values[environment]),
    };
  }

  if (environmentOptions?.aliases) {
    for (const alias of aliasesFor(environment, environmentOptions.aliases)) {
      if (alias in values) {
        return {
          ...values,
          [alias]: addOrReplace(values[alias]),
        };
      }
    }
  }

  return {
    ...values,
    [environment]: addArray,
  };
}

function decodeTypedArray(buf: ArrayBuffer): string {
  return String.fromCharCode.apply(null, (new Uint16Array(buf) as any) as number[]);
}

function stringAsTypedArray(str: string): Uint16Array {
  // 2 bytes for each char
  const buf = new ArrayBuffer(str.length * 2);
  const bufView = new Uint16Array(buf);

  for (let i = 0, strLen = str.length; i < strLen; i += 1) {
    bufView[i] = str.charCodeAt(i);
  }

  return bufView;
}

function encodeRevisionInPassword(password: Uint8Array, revision: number): Uint8Array {
  const revisionBytes = stringAsTypedArray(revision.toString());
  const passwordWithRevision = new Uint8Array(password.length + revisionBytes.length + 1);

  // first byte is the revision length, next N bytes is the revision as a string
  passwordWithRevision.set([revisionBytes.length], 0);
  passwordWithRevision.set(revisionBytes, 1);
  passwordWithRevision.set(password, revisionBytes.length + 1);

  return passwordWithRevision;
}

function verifyEncodedRevision(password: Uint8Array, expectedRevision: number) {
  const revisionBytesLength = password[0];
  const revisionBytes = password.slice(1, 1 + revisionBytesLength);
  const revision = decodeTypedArray(revisionBytes);

  if (parseFloat(revision) !== expectedRevision) {
    throw new EncryptionEncoding(oneLine`
      We detected tampering in the encryption key, revision ${expectedRevision}!
      This error occurs when the revision in the 'encryptionKeys' does not match the one that was embedded into the key.
      It might not be safe to continue using this encryption key.
      If you know that it is safe, change the revision in the app-config meta file to ${revision}.
    `);
  }
}
