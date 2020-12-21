import { join, resolve } from 'path';
import * as fs from 'fs-extra';
import * as pgp from 'openpgp';
import { inspect } from 'util';
import { generateKey, encrypt, decrypt, message, crypto } from 'openpgp';
import { oneLine } from 'common-tags';
import {
  FileType,
  Json,
  AppConfigError,
  EmptyStdinOrPromptResponse,
  InvalidEncryptionKey,
  EncryptionEncoding,
  SecretsRequireTTYError,
  stringify,
  logger,
} from '@app-config/core';
import { promptUser, promptUserWithRetry, checkTTY } from './common';
import { connectAgentLazy, shouldUseSecretAgent } from './secret-agent';
import { loadMetaConfig, loadMetaConfigLazy, MetaProperties } from './meta';
import { settingsDirectory } from './settings';

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

export async function initializeKeysManually(options: {
  name: string;
  email: string;
  passphrase?: string;
}) {
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

export async function initializeKeys(withPassphrase: boolean = true) {
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

export async function initializeLocalKeys() {
  if (await fs.pathExists(keyDirs.keychain)) {
    return false;
  }

  logger.info('Initializing your encryption keys');

  const { privateKeyArmored, publicKeyArmored, revocationCertificate } = await initializeKeys();

  const prevUmask = process.umask(0o077);

  try {
    await fs.mkdirp(keyDirs.keychain);

    process.umask(0o177);

    await Promise.all([
      fs.writeFile(keyDirs.privateKey, privateKeyArmored),
      fs.writeFile(keyDirs.publicKey, publicKeyArmored),
      fs.writeFile(keyDirs.revocationCert, revocationCertificate),
    ]);

    logger.info(`Wrote your encryption keys in ${keyDirs.keychain}`);
  } finally {
    process.umask(prevUmask);
  }

  return { publicKeyArmored };
}

export async function deleteLocalKeys() {
  await fs.remove(keyDirs.keychain);
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

export interface EncryptedSymmetricKey {
  revision: number;
  key: string;
}

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

export async function saveNewSymmetricKey(symmetricKey: DecryptedSymmetricKey, teamMembers: Key[]) {
  const encrypted = await encryptSymmetricKey(symmetricKey, teamMembers);

  await saveNewMetaFile(({ encryptionKeys = [], ...meta }) => ({
    ...meta,
    encryptionKeys: [...encryptionKeys, encrypted],
  }));
}

export async function loadSymmetricKeys(lazy = true): Promise<EncryptedSymmetricKey[]> {
  // flag is here mostly for testing
  const loadMeta = lazy ? loadMetaConfigLazy : loadMetaConfig;

  const {
    value: { encryptionKeys = [] },
  } = await loadMeta();

  return encryptionKeys;
}

export async function loadSymmetricKey(
  revision: number,
  privateKey: Key,
  lazyMeta = true,
): Promise<DecryptedSymmetricKey> {
  const symmetricKeys = await loadSymmetricKeys(lazyMeta);
  const symmetricKey = symmetricKeys.find((k) => k.revision === revision);

  if (!symmetricKey) throw new InvalidEncryptionKey(`Could not find symmetric key ${revision}`);

  logger.verbose(`Loading symmetric key r${symmetricKey.revision}`);

  return decryptSymmetricKey(symmetricKey, privateKey);
}

const symmetricKeys = new Map<number, Promise<DecryptedSymmetricKey>>();

export async function loadSymmetricKeyLazy(
  revision: number,
  privateKey: Key,
): Promise<DecryptedSymmetricKey> {
  if (!symmetricKeys.has(revision)) {
    symmetricKeys.set(revision, loadSymmetricKey(revision, privateKey, true));
  }

  return symmetricKeys.get(revision)!;
}

export async function loadLatestSymmetricKeyLazy(privateKey: Key): Promise<DecryptedSymmetricKey> {
  const allKeys = await loadSymmetricKeys();

  return loadSymmetricKeyLazy(latestSymmetricKeyRevision(allKeys), privateKey);
}

export async function encryptValue(
  value: Json,
  symmetricKeyOverride?: DecryptedSymmetricKey,
): Promise<string> {
  if (!symmetricKeyOverride && shouldUseSecretAgent()) {
    const client = await retrieveSecretAgent();

    if (client) {
      const allKeys = await loadSymmetricKeys();
      const latestRevision = latestSymmetricKeyRevision(allKeys);
      const symmetricKey = allKeys.find((k) => k.revision === latestRevision)!;

      return client.encryptValue(value, symmetricKey);
    }
  }

  let symmetricKey: DecryptedSymmetricKey;

  if (symmetricKeyOverride) {
    symmetricKey = symmetricKeyOverride;
  } else {
    symmetricKey = await loadLatestSymmetricKeyLazy(await loadPrivateKeyLazy());
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
): Promise<Json> {
  if (!symmetricKeyOverride && shouldUseSecretAgent()) {
    const client = await retrieveSecretAgent();

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

    symmetricKey = await loadSymmetricKeyLazy(revisionNumber, await loadPrivateKeyLazy());
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

export async function loadTeamMembers(lazy = true): Promise<Key[]> {
  const loadMeta = lazy ? loadMetaConfigLazy : loadMetaConfig;

  const {
    value: { teamMembers = [] },
  } = await loadMeta();

  return Promise.all(
    teamMembers.map(({ keyName, publicKey }) =>
      loadKey(publicKey).then((key) => Object.assign(key, { keyName })),
    ),
  );
}

let loadedTeamMembers: Promise<Key[]> | undefined;

export async function loadTeamMembersLazy(): Promise<Key[]> {
  if (!loadedTeamMembers) {
    loadedTeamMembers = loadTeamMembers();
  }

  return loadedTeamMembers;
}

export async function trustTeamMember(newTeamMember: Key, privateKey: Key) {
  const teamMembers = await loadTeamMembersLazy();

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
    await loadSymmetricKeys(),
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
    encryptionKeys: newEncryptionKeys,
  }));
}

export async function untrustTeamMember(email: string, privateKey: Key) {
  const teamMembers = await loadTeamMembersLazy();

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
    await loadSymmetricKeys(),
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
    encryptionKeys: newEncryptionKeys,
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

async function retrieveSecretAgent() {
  let client;

  try {
    client = await connectAgentLazy();
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
  const { value: oldMeta, filePath, fileType } = await loadMetaConfigLazy();

  const writeMeta = mutate(oldMeta) as Json;
  const writeFilePath = filePath ?? '.app-config.meta.yml';
  const writeFileType = fileType ?? FileType.YAML;

  logger.info(`Writing ${writeFilePath} file with new encryption properties`);
  await fs.writeFile(writeFilePath, stringify(writeMeta, writeFileType));
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
