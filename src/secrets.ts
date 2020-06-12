import { join } from 'path';
import { homedir } from 'os';
import * as fs from 'fs-extra';
import { key, message, generateKey, encrypt, decrypt } from 'openpgp';
import * as prompts from 'prompts';
import { stringify, FileType } from './file-loader';
import { loadMeta, findMetaFile } from './meta';

// TODO: non-string encrypted secrets
// TODO: revocation
// TODO: anyone can encrypt secrets if they have the team members list

export const dirs = {
  get keychain() {
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
    { name: 'name', message: 'Your name', type: 'text' },
    { name: 'email', message: 'Your email', type: 'text' },
  ]);

  let passphrase;

  if (withPassphrase) {
    ({ passphrase } = await prompts({
      name: 'passphrase',
      message: 'Passphrase',
      type: 'password',
    }));
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
};

export const initializeLocalKeys = async () => {
  if (await fs.pathExists(dirs.keychain)) {
    return false;
  }

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

let privateKey: key.Key | undefined;
let publicKey: key.Key | undefined;

export const loadPrivateKeyLazy = async () => {
  if (!privateKey) {
    if (process.env.APP_CONFIG_SECRETS_KEY) {
      privateKey = await loadKey(process.env.APP_CONFIG_SECRETS_KEY);
    } else {
      if (process.env.CI) {
        console.warn(
          'Warning! Trying to load encryption keys from home folder in a CI environment',
        );
      }

      await initializeLocalKeys();
      privateKey = await loadKey(await fs.readFile(dirs.privateKey));

      if (!privateKey.isDecrypted()) {
        const { passphrase } = await prompts([
          { name: 'passphrase', message: 'Passphrase', type: 'password' },
        ]);

        await privateKey.decrypt(passphrase);
      }
    }
  }

  return privateKey;
};

export const loadPublicKeyLazy = async () => {
  if (!publicKey) {
    if (process.env.APP_CONFIG_SECRETS_PUBLIC_KEY) {
      publicKey = await loadKey(process.env.APP_CONFIG_SECRETS_PUBLIC_KEY);
    } else {
      if (process.env.CI) {
        console.warn(
          'Warning! Trying to load encryption keys from home folder in a CI environment',
        );
      }

      await initializeLocalKeys();
      publicKey = await loadKey(await fs.readFile(dirs.publicKey));
    }
  }

  return publicKey;
};

const loadTeamMembers = async () => {
  const { teamMembers = [] } = await loadMeta();

  const allKeys = [];

  for (const teamMember of teamMembers) {
    const { keys, err } = await key.readArmored(teamMember);
    if (err) throw err[0];

    allKeys.push(...keys);
  }

  return allKeys;
};

export const encryptText = async (text: string) => {
  const allKeys = await loadTeamMembers();
  // TODO: sign with private key
  // const privateKey = await loadPrivateKeyLazy();

  const { data } = await encrypt({
    message: message.fromText(text),
    publicKeys: [...allKeys],
    // privateKeys: [privateKey],
  });

  return data;
};

export const decryptText = async (text: string) => {
  const privateKey = await loadPrivateKeyLazy();
  // TODO: verify signature against team members
  // const allKeys = await loadTeamMembers();

  const { data } = await decrypt({
    message: await message.readArmored(text),
    privateKeys: [privateKey],
    // publicKeys: [...allKeys],
  });

  return data;
};

export const trustTeamMember = async (publicKey: string) => {
  const { keys, err } = await key.readArmored(publicKey);
  if (err) throw err[0];

  const { teamMembers = [], ...meta } = await loadMeta();

  for (const key of keys) {
    if (key.isPrivate()) {
      throw new Error(
        'A private key was passed in as a team member. Only public keys should be in team members.',
      );
    }

    teamMembers.push(key.armor());
  }

  const foundMeta = await findMetaFile();

  if (!foundMeta) {
    await fs.writeFile('.app-config.meta.yml', stringify({ teamMembers }, FileType.YAML));
  } else {
    await fs.writeFile(foundMeta[1], stringify({ ...meta, teamMembers } as any, foundMeta[0]));
  }

  // TODO: rewrite every embedded secret
};
