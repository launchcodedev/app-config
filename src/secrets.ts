import { join } from 'path';
import { homedir } from 'os';
import * as fs from 'fs-extra';
import { key, message, generateKey, encrypt, decrypt, util } from 'openpgp';
import * as prompts from 'prompts';

// TODO: init a certificate
// TODO: add user to certificate
// TODO: revocation

const keychainDir = join(homedir(), '.app-config', 'keychain');
const privateKeyPath = join(keychainDir, 'private-key.asc');
const publicKeyPath = join(keychainDir, 'public-key.asc');
const revocationCertPath = join(keychainDir, 'revocation.asc');

export const initializeSecrets = async (cwd: string) => {
  if (!(await fs.pathExists(keychainDir))) {
    const { name, email, passphrase } = await prompts([
      { name: 'name', message: 'Your name', type: 'text' },
      { name: 'email', message: 'Your email', type: 'text' },
      { name: 'passphrase', message: 'Passphrase', type: 'password' },
    ]);

    const { privateKeyArmored, publicKeyArmored, revocationCertificate } = await generateKey({
      curve: 'ed25519',
      userIds: [{ name, email }],
      passphrase,
    });

    await fs.mkdirp(keychainDir);

    // TODO: umask these
    await Promise.all([
      fs.writeFile(privateKeyPath, privateKeyArmored),
      fs.writeFile(publicKeyPath, publicKeyArmored),
      fs.writeFile(revocationCertPath, revocationCertificate),
    ]);
  }
};

export const loadPrivateKey = async () => {
  const {
    keys: [privateKey],
  } = await key.readArmored(await fs.readFile(privateKeyPath));

  return privateKey;
};

export const loadPublicKey = async () => {
  const {
    keys: [publicKey],
  } = await key.readArmored(await fs.readFile(publicKeyPath));

  return publicKey;
};

let privateKey: key.Key | undefined;
let publicKey: key.Key | undefined;

export const loadPrivateKeyLazy = async () => {
  if (!privateKey) {
    await initializeSecrets(process.cwd());

    privateKey = await loadPrivateKey();
  }

  return privateKey;
}

export const loadPublicKeyLazy = async () => {
  if (!publicKey) {
    await initializeSecrets(process.cwd());

    publicKey = await loadPublicKey();
  }

  return publicKey;
}

export const loadSharedKey = async () => {
  const publicKey = await loadPublicKeyLazy();
  const myUser = await publicKey.getPrimaryUser().then(u => util.parseUserId(u.user.userId.userid));

  console.log(myUser)
  const { publicKeyArmored } = await generateKey({
    userIds: [myUser],
  });

  const {
    keys: [sharedKey],
  } = await key.readArmored(publicKeyArmored);

  return sharedKey;
};

export const encryptText = async (text: string) => {
  const publicKey = await loadSharedKey();

  const { data } = await encrypt({
    message: message.fromText(text),
    publicKeys: [publicKey],
  });

  return data;
};

export const decryptText = async (text: string) => {
  const privateKey = await loadPrivateKeyLazy();

  if (!privateKey.isDecrypted()) {
    const { passphrase } = await prompts([
      { name: 'passphrase', message: 'Passphrase', type: 'password' },
    ]);

    await privateKey.decrypt(passphrase);
  }

  const { data } = await decrypt({
    message: await message.readArmored(text),
    privateKeys: [privateKey],
  });

  return data;
};
