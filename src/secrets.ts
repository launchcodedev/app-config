import { join, resolve } from 'path';
import { homedir } from 'os';
import * as fs from 'fs-extra';
import { key, message, generateKey, encrypt, decrypt, crypto } from 'openpgp';
import * as prompts from 'prompts';
import { oneLine } from 'common-tags';
import { stringify, FileType } from './file-loader';
import { loadMeta, findMetaFile } from './meta';

export interface SymmetricKey {
  // what "version" of the key is it
  revision: number;
  // this is in encrypted form, decrypt using any team member's private key
  key: string;
}

export interface TeamMember {
  userId: string;
  publicKey: string;
}

type Key = key.Key;

export const dirs = {
  get keychain() {
    if (process.env.APP_CONFIG_SECRETS_KEYCHAIN_FOLDER) {
      return resolve(process.env.APP_CONFIG_SECRETS_KEYCHAIN_FOLDER);
    }

    return join(homedir(), '.app-config', 'keychain');
  },
  get privateKey() {
    return join(dirs.keychain, 'private-key.asc');
  },
  get publicKey() {
    return join(dirs.keychain, 'public-key.asc');
  },
  get revocationCert() {
    return join(dirs.keychain, 'revocation.asc');
  },
};

export const initializeKeys = async (withPassphrase: boolean = true) => {
  const { name, email } = await prompts([
    { name: 'name', message: 'Name', type: 'text' },
    { name: 'email', message: 'Email', type: 'text' },
  ]);

  let passphrase;

  if (withPassphrase) {
    ({ passphrase } = await prompts({
      name: 'passphrase',
      message: 'Passphrase',
      type: 'password',
    }));
  }

  if (!name) throw new Error('No name given');
  if (!email) throw new Error('No email given');
  if (withPassphrase && !passphrase) throw new Error('No passphrase given');

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
};

export const initializeLocalKeys = async () => {
  if (await fs.pathExists(dirs.keychain)) {
    return false;
  }

  console.warn('Initiliazing your encryption keys');

  const { privateKeyArmored, publicKeyArmored, revocationCertificate } = await initializeKeys();

  const prevUmask = process.umask(0o077);

  await fs.mkdirp(dirs.keychain);

  process.umask(0o177);

  await Promise.all([
    fs.writeFile(dirs.privateKey, privateKeyArmored),
    fs.writeFile(dirs.publicKey, publicKeyArmored),
    fs.writeFile(dirs.revocationCert, revocationCertificate),
  ]);

  process.umask(prevUmask);

  return { publicKeyArmored };
};

export const resetKeys = async () => {
  await fs.remove(dirs.keychain);
};

export const loadKey = async (contents: string | Buffer) => {
  const { err, keys } = await key.readArmored(contents);

  if (err) throw err[0];

  return keys[0];
};

let privateKey: Promise<Key> | undefined;
let publicKey: Promise<Key> | undefined;

export const loadPrivateKeyLazy = async (): Promise<Key> => {
  if (!privateKey) {
    if (process.env.APP_CONFIG_SECRETS_KEY) {
      privateKey = loadKey(process.env.APP_CONFIG_SECRETS_KEY);
    } else {
      if (process.env.CI) {
        console.warn(
          'Warning! Trying to load encryption keys from home folder in a CI environment',
        );
      }

      privateKey = Promise.resolve().then(async () => {
        await initializeLocalKeys();

        const privateKey = await loadKey(await fs.readFile(dirs.privateKey));

        if (!privateKey.isDecrypted()) {
          const { passphrase } = await prompts([
            { name: 'passphrase', message: 'Your passphrase', type: 'password' },
          ]);

          await privateKey.decrypt(passphrase);
        }

        return privateKey;
      });
    }
  }

  return privateKey;
};

export const loadPublicKeyLazy = async (): Promise<Key> => {
  if (!publicKey) {
    if (process.env.APP_CONFIG_SECRETS_PUBLIC_KEY) {
      publicKey = loadKey(process.env.APP_CONFIG_SECRETS_PUBLIC_KEY);
    } else {
      if (process.env.CI) {
        console.warn(
          'Warning! Trying to load encryption keys from home folder in a CI environment',
        );
      }

      publicKey = Promise.resolve().then(async () => {
        await initializeLocalKeys();
        return loadKey(await fs.readFile(dirs.publicKey));
      });
    }
  }

  return publicKey;
};

let teamMembers: Promise<Key[]> | undefined;

export const loadTeamMembersLazy = async (): Promise<Key[]> => {
  if (!teamMembers) {
    teamMembers = Promise.resolve().then(async () => {
      const teamMembers = [];
      const { teamMembers: teamMemberKeys = [] } = await loadMeta();

      for (const { publicKey } of teamMemberKeys) {
        const { keys, err } = await key.readArmored(publicKey);

        if (err) throw err[0];

        teamMembers.push(...keys);
      }

      return teamMembers;
    });
  }

  return teamMembers;
};

let encryptionKeys: Promise<SymmetricKey[]> | undefined;

export const loadSymmetricKeysLazy = async (): Promise<SymmetricKey[]> => {
  if (!encryptionKeys) {
    encryptionKeys = loadMeta().then(meta => meta.encryptionKeys ?? []);
  }

  return encryptionKeys;
};

export const loadSymmetricKey = async (revision: number): Promise<SymmetricKey> => {
  const encryptionKeys = await loadSymmetricKeysLazy();
  const found = encryptionKeys.find(k => k.revision === revision);

  if (!found) {
    throw new Error(`No symmetric key ${revision} found`);
  }

  const privateKey = await loadPrivateKeyLazy();

  try {
    const { data: key } = await decrypt({
      message: await message.readArmored(found.key),
      privateKeys: [privateKey],
      format: 'utf8',
    });

    verifyEncodedRevision(key, revision);

    return { key, revision };
  } catch (err) {
    const teamMembers = await loadTeamMembersLazy();
    const teamMembersString = teamMembers.map(m => m.getUserIds().join(', ')).join(', ');

    throw new Error(oneLine`
      There was an error decrypting secrets that are present in app-config.
      You most likely haven\'t been trusted.
      For help, you might want to contact one of the trusted team members: ${teamMembersString}
    `);
  }
};

export const loadLatestSymmetricKey = async (): Promise<SymmetricKey> => {
  const encryptionKeys = await loadSymmetricKeysLazy();

  encryptionKeys.sort((a, b) => a.revision - b.revision);

  if (encryptionKeys.length === 0) {
    throw new Error('No symmetric keys found');
  }

  const { revision } = encryptionKeys[encryptionKeys.length - 1];

  return loadSymmetricKey(revision);
};

export const createSymmetricKey = async (
  teamMembers?: Key[],
  revision?: number,
): Promise<SymmetricKey> => {
  if (!revision) {
    const encryptionKeys = await loadSymmetricKeysLazy();

    if (encryptionKeys.length > 0) {
      const latest = await loadLatestSymmetricKey();

      revision = latest.revision + 1;
    } else {
      revision = 1;
    }
  }

  if (!teamMembers) teamMembers = await loadTeamMembersLazy();
  const password = await crypto.random.getRandomBytes(2048); // eslint-disable-line @typescript-eslint/await-thenable
  const passwordWithRevision = encodeRevisionInPassword(password, revision);

  if (teamMembers.length === 0) {
    throw new Error('Cannot create a symmetric key with no teamMembers');
  }

  const { data: key } = await encrypt({
    message: message.fromBinary(passwordWithRevision),
    publicKeys: [...teamMembers],
  });

  return { revision, key };
};

export const saveSymmetricKey = async (key: SymmetricKey): Promise<SymmetricKey> => {
  const { teamMembers = [], encryptionKeys = [], ...meta } = await loadMeta();
  const newMeta: any = { ...meta, teamMembers, encryptionKeys: [...encryptionKeys, key] };

  const foundMeta = await findMetaFile();

  if (!foundMeta) {
    await fs.writeFile('.app-config.meta.yml', stringify(newMeta, FileType.YAML));
  } else {
    await fs.writeFile(foundMeta[1], stringify(newMeta, foundMeta[0]));
  }

  return key;
};

const base64Regex = /\r\n\r\n((?:\S+\r\n)+)-----END PGP MESSAGE-----/g;

type Json = string | number | null | { [k: string]: Json } | Json[];

export const encryptValue = async (value: Json): Promise<string> => {
  const text = JSON.stringify(value);
  const { revision, key } = await loadLatestSymmetricKey();

  const { data } = await encrypt({
    message: message.fromText(text),
    passwords: [key],
  });

  const extracted = base64Regex.exec(data.toString());

  if (!extracted) {
    throw new Error('Invalid message was formed in encryption');
  }

  const [, base64] = extracted;

  return `encrypted:${revision}:${base64.split('\r\n').join('')}`;
};

export const decryptText = async (text: string): Promise<string> => {
  const [, revision, base64] = text.split(':');
  const { key } = await loadSymmetricKey(parseFloat(revision));

  const armored = `${'-----BEGIN PGP MESSAGE-----\nVersion: OpenPGP.js VERSION\n\n'}${base64}\n-----END PGP PUBLIC KEY BLOCK-----`;

  try {
    const { data } = await decrypt({
      message: await message.readArmored(armored),
      passwords: [key],
      format: 'utf8',
    });

    return JSON.parse(data);
  } catch (err) {
    throw new Error(oneLine`
      There was an error decrypting a secret, which was encrypted with key ${revision}.
      Were you trusted with this key?
    `);
  }
};

export const trustTeamMember = async (publicKey: string) => {
  const { keys, err } = await key.readArmored(publicKey);

  if (err) throw err[0];

  const teamMembers = await loadTeamMembersLazy();

  for (const key of keys) {
    if (key.isPrivate()) {
      throw new Error(
        'A private key was passed in as a team member. Only public keys should be in team members.',
      );
    }

    const duplicate = teamMembers.find(k => k.getUserIds().join('') === key.getUserIds().join(''));

    if (duplicate) {
      console.warn(
        `Warning! The team member ${duplicate
          .getUserIds()
          .join(', ')} was already trusted. Adding anyways.`,
      );
    }

    teamMembers.push(key);
  }

  const encryptionKeys = await loadSymmetricKeysLazy();

  let newEncryptionKeys = [];

  if (encryptionKeys.length > 0) {
    // re-encrypt every key using the updated teamMembers list, giving access to any previously encrypted secrets
    for (const { revision } of encryptionKeys) {
      const key = await loadSymmetricKey(revision);
      newEncryptionKeys.push(await reencryptSymmetricKey(key, teamMembers));
    }
  } else {
    // there were no symmetric keys yet, so we can just make a new one
    newEncryptionKeys = [await createSymmetricKey(teamMembers)];
  }

  const newMeta: any = await loadMeta();

  Object.assign(newMeta, {
    teamMembers: teamMembers.map(key => ({ userId: key.getUserIds()[0], publicKey: key.armor() })),
    encryptionKeys: newEncryptionKeys,
  });

  const foundMeta = await findMetaFile();

  if (!foundMeta) {
    await fs.writeFile('.app-config.meta.yml', stringify(newMeta, FileType.YAML));
  } else {
    await fs.writeFile(foundMeta[1], stringify(newMeta, foundMeta[0]));
  }
};

export const untrustTeamMember = async (email: string) => {
  const teamMembers = await loadTeamMembersLazy();

  const newTeamMembers = teamMembers.filter(teamMember => {
    if (teamMember.getUserIds().some(u => u.includes(`<${email}>`))) {
      console.log(`Removing trust from ${teamMember.getUserIds().join(', ')}`);
      return false;
    }

    return true;
  });

  if (newTeamMembers.length === teamMembers.length) {
    throw new Error(`There were no team members with email ${email}`);
  }

  if (newTeamMembers.length === 0) {
    throw new Error('You cannot remove the last team member, since there would be no one to trust');
  }

  const encryptionKeys = await loadSymmetricKeysLazy();

  // re-encrypt symmetric keys without the team member
  // this isn't actually secure on its own, which is why we create a new one
  // we do this solely to make it harder to go back in time and get old secrets
  // of course, nothing stops users from having previously copy-pasted secrets, so they should always be rotated when untrusting old users
  // reason being, they had previous access to the actual private symmetric key
  const newEncryptionKeys = [];

  for (const { revision } of encryptionKeys) {
    const key = await loadSymmetricKey(revision);
    newEncryptionKeys.push(await reencryptSymmetricKey(key, newTeamMembers));
  }

  newEncryptionKeys.push(await createSymmetricKey(newTeamMembers));

  const newMeta: any = await loadMeta();

  Object.assign(newMeta, {
    teamMembers: newTeamMembers.map(key => ({
      userId: key.getUserIds()[0],
      publicKey: key.armor(),
    })),
    encryptionKeys: newEncryptionKeys,
  });

  const foundMeta = await findMetaFile();

  if (!foundMeta) {
    await fs.writeFile('.app-config.meta.yml', stringify(newMeta, FileType.YAML));
  } else {
    await fs.writeFile(foundMeta[1], stringify(newMeta, foundMeta[0]));
  }
};

export const reencryptSymmetricKey = async (
  { revision, key }: SymmetricKey,
  teamMembers: Key[],
) => {
  const { data } = await encrypt({
    message: message.fromText(key),
    publicKeys: [...teamMembers],
  });

  return { revision, key: data };
};

const decodeTypedArray = (buf: ArrayBuffer) => {
  return String.fromCharCode.apply(null, (new Uint16Array(buf) as any) as number[]);
};

const stringAsTypedArray = (str: string) => {
  // 2 bytes for each char
  const buf = new ArrayBuffer(str.length * 2);
  const bufView = new Uint16Array(buf);

  for (let i = 0, strLen = str.length; i < strLen; i += 1) {
    bufView[i] = str.charCodeAt(i);
  }

  return bufView;
};

const encodeRevisionInPassword = (password: Uint8Array, revision: number) => {
  const revisionBytes = stringAsTypedArray(revision.toString());
  const passwordWithRevision = new Uint8Array(password.length + revisionBytes.length + 1);

  // first byte is the revision length, next N bytes is the revision as a string
  passwordWithRevision.set([revisionBytes.length], 0);
  passwordWithRevision.set(revisionBytes, 1);
  passwordWithRevision.set(password, revisionBytes.length + 1);

  return passwordWithRevision;
};

const verifyEncodedRevision = (password: string, expectedRevision: number) => {
  const passwordWithRevision = stringAsTypedArray(password);
  const revisionBytesLength = passwordWithRevision[0];
  const revisionBytes = passwordWithRevision.slice(1, 1 + revisionBytesLength);
  const revision = decodeTypedArray(revisionBytes);

  if (parseFloat(revision) !== expectedRevision) {
    throw new Error(oneLine`
      We detected tampering in the encryption key, revision ${expectedRevision}!
      This error occurs when the revision in the 'encryptionKeys' does not match the one that was embedded into the key.
      It might not be safe to continue using this encryption key.
      If you know that it is safe, change the revision in the app-config meta file to ${revision}.
    `);
  }
};
