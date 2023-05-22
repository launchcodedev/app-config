import { readFile, stat } from 'fs-extra';
import { isWindows } from '@app-config/utils';
import { SecretsRequireTTYError } from '@app-config/core';
import { loadMetaConfig } from '@app-config/meta';
import { withTempFiles, mockedStdin } from '@app-config/test-utils';

import { defaultEnvOptions } from '@app-config/node';
import {
  initializeKeys,
  initializeKeysManually,
  initializeLocalKeys,
  deleteLocalKeys,
  loadPrivateKey,
  loadPublicKey,
  loadLatestSymmetricKey,
  generateSymmetricKey,
  encryptSymmetricKey,
  decryptSymmetricKey,
  saveNewSymmetricKey,
  encryptValue,
  decryptValue,
  loadTeamMembers,
  trustTeamMember,
  untrustTeamMember,
  getRevisionNumber,
} from './encryption';

describe('User Keys', () => {
  it('initialize keys without passphrase', async () => {
    const { privateKeyArmored, publicKeyArmored } = await initializeKeysManually({
      name: 'Tester',
      email: 'test@example.com',
    });

    await loadPublicKey(publicKeyArmored);
    await loadPrivateKey(privateKeyArmored);
  });

  it('initialize keys with passphrase', async () => {
    const { privateKeyArmored, publicKeyArmored } = await initializeKeysManually({
      name: 'Tester',
      email: 'test@example.com',
      passphrase: 'Secret!',
    });

    await loadPublicKey(publicKeyArmored);
    await expect(loadPrivateKey(privateKeyArmored)).rejects.toBeInstanceOf(SecretsRequireTTYError);
  });

  it('initializes keys with a passphrase from stdin', async () => {
    await mockedStdin(async (send) => {
      send('My Name')
        .then(() => send('me@example.com'))
        .then(() => send('$ecure!'))
        .catch(() => {});

      const { privateKeyArmored, publicKeyArmored } = await initializeKeys();

      await loadPublicKey(publicKeyArmored);

      send('$ecure!').catch(() => {});

      await loadPrivateKey(privateKeyArmored);
    });
  });

  it('initializes keys into a directory', async () => {
    await withTempFiles({}, async (inDir) => {
      const keys = {
        privateKeyArmored: 'privateKeyArmored',
        publicKeyArmored: 'publicKeyArmored',
        revocationCertificate: 'revocationCertificate',
      };

      const dirs = {
        keychain: inDir('keychain'),
        privateKey: inDir('keychain/private-key.asc'),
        publicKey: inDir('keychain/public-key.asc'),
        revocationCert: inDir('keychain/revocation.asc'),
      };

      const returned = await initializeLocalKeys(keys, dirs);

      expect(returned).toEqual({ publicKeyArmored: 'publicKeyArmored' });

      expect((await readFile(inDir('keychain/private-key.asc'))).toString()).toEqual(
        'privateKeyArmored',
      );
      expect((await readFile(inDir('keychain/public-key.asc'))).toString()).toEqual(
        'publicKeyArmored',
      );

      // eslint-disable-next-line no-bitwise
      const modeToOctal = (mode: number) => (mode & 0o777).toString(8);

      if (!isWindows) {
        expect(modeToOctal((await stat(inDir('keychain/private-key.asc'))).mode)).toBe('600');
      } else {
        expect(modeToOctal((await stat(inDir('keychain/private-key.asc'))).mode)).toBe('666');
      }

      await deleteLocalKeys(dirs);
    });
  });
});

const createKeys = async () => {
  const { privateKeyArmored, publicKeyArmored } = await initializeKeysManually({
    name: 'Tester',
    email: 'test@example.com',
  });

  return {
    privateKey: await loadPrivateKey(privateKeyArmored),
    publicKey: await loadPublicKey(publicKeyArmored),
    privateKeyArmored,
    publicKeyArmored,
  };
};

describe('User keys from environment', () => {
  it('loads user keys from environment', async () => {
    const keys = await createKeys();

    process.env.APP_CONFIG_SECRETS_PUBLIC_KEY = keys.publicKeyArmored;
    process.env.APP_CONFIG_SECRETS_KEY = keys.privateKeyArmored;

    const privateKey = await loadPrivateKey();
    const publicKey = await loadPublicKey();

    expect(privateKey.getFingerprint()).toEqual(keys.privateKey.getFingerprint());
    expect(publicKey.getFingerprint()).toEqual(keys.publicKey.getFingerprint());
  });

  it('loads environment user keys from environment', async () => {
    const keys = await createKeys();

    process.env.APP_CONFIG_SECRETS_PUBLIC_KEY_PRODUCTION = keys.publicKeyArmored;
    process.env.APP_CONFIG_SECRETS_KEY_PRODUCTION = keys.privateKeyArmored;
    process.env.APP_CONFIG_ENV = 'prod';

    const privateKey = await loadPrivateKey(undefined, defaultEnvOptions);
    const publicKey = await loadPublicKey(undefined, defaultEnvOptions);

    expect(privateKey.getFingerprint()).toEqual(keys.privateKey.getFingerprint());
    expect(publicKey.getFingerprint()).toEqual(keys.publicKey.getFingerprint());
  });

  it('loads aliased environment user keys from environment', async () => {
    const keys = await createKeys();

    process.env.APP_CONFIG_SECRETS_PUBLIC_KEY_PROD = keys.publicKeyArmored;
    process.env.APP_CONFIG_SECRETS_KEY_PROD = keys.privateKeyArmored;
    process.env.APP_CONFIG_ENV = 'prod';

    const privateKey = await loadPrivateKey(undefined, defaultEnvOptions);
    const publicKey = await loadPublicKey(undefined, defaultEnvOptions);

    expect(privateKey.getFingerprint()).toEqual(keys.privateKey.getFingerprint());
    expect(publicKey.getFingerprint()).toEqual(keys.publicKey.getFingerprint());
  });

  it('falls back to key with no environment', async () => {
    const keys = await createKeys();

    process.env.APP_CONFIG_SECRETS_PUBLIC_KEY = keys.publicKeyArmored;
    process.env.APP_CONFIG_SECRETS_KEY = keys.privateKeyArmored;
    process.env.APP_CONFIG_ENV = 'prod';

    const privateKey = await loadPrivateKey(undefined, defaultEnvOptions);
    const publicKey = await loadPublicKey(undefined, defaultEnvOptions);

    expect(privateKey.getFingerprint()).toEqual(keys.privateKey.getFingerprint());
    expect(publicKey.getFingerprint()).toEqual(keys.publicKey.getFingerprint());
  });
});

const createKey = async () => {
  const { privateKeyArmored } = await initializeKeysManually({
    name: 'Tester',
    email: 'test@example.com',
  });

  return loadPrivateKey(privateKeyArmored);
};

describe('Symmetric Keys', () => {
  it('generates a plain symmetric key', async () => {
    const symmetricKey = await generateSymmetricKey('1');

    expect(symmetricKey.revision).toBe('1');
    expect(symmetricKey.key).toBeInstanceOf(Uint8Array);
    expect(symmetricKey.key.length).toBeGreaterThan(2048);
  });

  it('encrypts and decrypts a symmetric key', async () => {
    const privateKey = await createKey();
    const symmetricKey = await generateSymmetricKey('1');
    const encryptedKey = await encryptSymmetricKey(symmetricKey, [privateKey]);

    expect(encryptedKey.revision).toBe('1');
    expect(typeof encryptedKey.key).toBe('string');
    expect(encryptedKey.key.length).toBeGreaterThan(0);

    const decryptedKey = await decryptSymmetricKey(encryptedKey, privateKey);

    expect(decryptedKey.revision).toBe('1');
    expect(decryptedKey.key).toEqual(symmetricKey.key);
  });

  it('cannot decrypt a symmetric key that was created by someone else', async () => {
    const privateKey = await createKey();
    const someoneElsesKey = await createKey();

    const symmetricKey = await generateSymmetricKey('1');
    const encryptedKey = await encryptSymmetricKey(symmetricKey, [someoneElsesKey]);

    await expect(decryptSymmetricKey(encryptedKey, privateKey)).rejects.toThrow();
  });

  it('can decrypt a symmetric key from multiple private keys', async () => {
    const privateKey = await createKey();
    const someoneElsesKey = await createKey();

    const symmetricKey = await generateSymmetricKey('1');
    const encryptedKey = await encryptSymmetricKey(symmetricKey, [privateKey, someoneElsesKey]);

    await expect(decryptSymmetricKey(encryptedKey, privateKey)).resolves.toEqual(symmetricKey);
    await expect(decryptSymmetricKey(encryptedKey, someoneElsesKey)).resolves.toEqual(symmetricKey);
  });

  it('can re-encrypt a key that was previously only for one person', async () => {
    const privateKey = await createKey();
    const someoneElsesKey = await createKey();

    const symmetricKey = await generateSymmetricKey('1');
    const encryptedKey = await encryptSymmetricKey(symmetricKey, [privateKey]);
    const decryptedKey = await decryptSymmetricKey(encryptedKey, privateKey);
    const encryptedKey2 = await encryptSymmetricKey(decryptedKey, [privateKey, someoneElsesKey]);
    const decryptedKey2 = await decryptSymmetricKey(encryptedKey2, someoneElsesKey);

    expect(decryptedKey).toEqual(symmetricKey);
    expect(decryptedKey2).toEqual(symmetricKey);
  });

  it('validates encoded revision number in keys', async () => {
    const privateKey = await createKey();
    const symmetricKey = await generateSymmetricKey('1');
    const encryptedKey = await encryptSymmetricKey(symmetricKey, [privateKey]);

    // really go out of our way to mess with the key - this usually results in integrity check failures either way
    const ind = encryptedKey.key.indexOf('\r\n\r\n') + 4;
    const rev = String.fromCharCode(encryptedKey.key.charCodeAt(ind) + 1);
    encryptedKey.key = encryptedKey.key.slice(0, ind) + rev + encryptedKey.key.slice(ind + 1);

    await expect(decryptSymmetricKey(encryptedKey, privateKey)).rejects.toThrow();
  });
});

describe('Value Encryption', () => {
  it('encrypts and decrypts JSON-compatible values', async () => {
    const values = ['hello world', 42.42, null, true, { message: 'hello world', nested: {} }];

    for (const value of values) {
      const symmetricKey = await generateSymmetricKey('1');
      const encrypted = await encryptValue(value, symmetricKey);
      const decrypted = await decryptValue(encrypted, symmetricKey);

      expect(typeof encrypted).toEqual('string');
      expect(encrypted).toMatch(/^enc:1:/);
      expect(decrypted).toEqual(value);
    }
  });

  it('cannot decrypt a value with the wrong key', async () => {
    const value = 'hello world';
    const symmetricKey = await generateSymmetricKey('1');
    const wrongKey = await generateSymmetricKey('1');
    const encrypted = await encryptValue(value, symmetricKey);

    await expect(decryptValue(encrypted, wrongKey)).rejects.toThrow();
  });
});

describe('per environment encryption E2E', () => {
  it('sets up, trusts and untrusts users correctly', () => {
    const cwd = process.cwd();

    return withTempFiles({}, async (inDir) => {
      // run environmentless
      delete process.env.NODE_ENV;

      process.chdir(inDir('.'));
      process.env.APP_CONFIG_SECRETS_KEYCHAIN_FOLDER = inDir('keychain');

      const keys = await initializeKeysManually({
        name: 'Tester',
        email: 'test@example.com',
      });

      const dirs = {
        keychain: inDir('keychain'),
        privateKey: inDir('keychain/private-key.asc'),
        publicKey: inDir('keychain/public-key.asc'),
        revocationCert: inDir('keychain/revocation.asc'),
      };

      expect(await initializeLocalKeys(keys, dirs)).toEqual({
        publicKeyArmored: keys.publicKeyArmored,
      });

      const publicKey = await loadPublicKey();
      const privateKey = await loadPrivateKey();

      // this is what init-repo does
      await trustTeamMember(publicKey, privateKey);

      // at this point, we should have ourselves trusted, and 1 symmetric key
      const { value: meta } = await loadMetaConfig();

      expect(meta.teamMembers).toHaveProperty('default');
      expect(meta.encryptionKeys).toHaveProperty('default');
      expect((meta.teamMembers! as any).default).toHaveLength(1);
      expect((meta.encryptionKeys! as any).default).toHaveLength(1);

      const encryptionKey = await loadLatestSymmetricKey(privateKey);
      const encrypted = await encryptValue('a secret value', encryptionKey);
      await expect(decryptValue(encrypted, encryptionKey)).resolves.toBe('a secret value');

      // now lets create a new environment
      await trustTeamMember(publicKey, privateKey, { ...defaultEnvOptions, override: 'prod' });

      // at this point, we should have a default and a prod env with 1 trusted member and 1 key each
      const { value: prodEnvMeta } = await loadMetaConfig();

      expect(prodEnvMeta.teamMembers).toHaveProperty('default');
      expect(prodEnvMeta.encryptionKeys).toHaveProperty('default');
      expect((prodEnvMeta.teamMembers! as any).default).toHaveLength(1);
      expect((prodEnvMeta.encryptionKeys! as any).default).toHaveLength(1);
      expect(prodEnvMeta.teamMembers).toHaveProperty('production');
      expect(prodEnvMeta.encryptionKeys).toHaveProperty('production');
      expect((prodEnvMeta.teamMembers! as any).production).toHaveLength(1);
      expect((prodEnvMeta.encryptionKeys! as any).production).toHaveLength(1);

      const prodEncryptionKey = await loadLatestSymmetricKey(privateKey);
      const prodEncrypted = await encryptValue('a secret value', prodEncryptionKey);
      await expect(decryptValue(prodEncrypted, prodEncryptionKey)).resolves.toBe('a secret value');

      const teammateKeys = await initializeKeysManually({
        name: 'A Teammate',
        email: 'teammate@example.com',
      });

      const teammatePublicKey = await loadPublicKey(teammateKeys.publicKeyArmored);
      const teammatePrivateKey = await loadPrivateKey(teammateKeys.privateKeyArmored);

      await trustTeamMember(teammatePublicKey, privateKey);

      // at this point, we should have 2 team members, but still 1 symmetric key
      const { value: metaAfterTrustingTeammate } = await loadMetaConfig();

      expect(metaAfterTrustingTeammate.teamMembers).toHaveProperty('default');
      expect(metaAfterTrustingTeammate.encryptionKeys).toHaveProperty('default');
      expect((metaAfterTrustingTeammate.teamMembers! as any).default).toHaveLength(2);
      expect((metaAfterTrustingTeammate.encryptionKeys! as any).default).toHaveLength(1);
      expect(metaAfterTrustingTeammate.teamMembers).toHaveProperty('production');
      expect(metaAfterTrustingTeammate.encryptionKeys).toHaveProperty('production');
      expect((metaAfterTrustingTeammate.teamMembers! as any).production).toHaveLength(1);
      expect((metaAfterTrustingTeammate.encryptionKeys! as any).production).toHaveLength(1);

      // ensures that the teammate can now encrypt/decrypt values
      const encryptedByTeammate = await encryptValue(
        'a secret value',
        await loadLatestSymmetricKey(teammatePrivateKey),
      );
      await expect(
        decryptValue(encryptedByTeammate, await loadLatestSymmetricKey(teammatePrivateKey)),
      ).resolves.toBe('a secret value');

      // ensures that we can still encrypt/decrypt values
      const encryptedByUs = await encryptValue(
        'a secret value',
        await loadLatestSymmetricKey(privateKey),
      );
      await expect(
        decryptValue(encryptedByUs, await loadLatestSymmetricKey(privateKey)),
      ).resolves.toBe('a secret value');

      await untrustTeamMember('teammate@example.com', privateKey);

      // at this point, we should have 1 team members, and a newly generated symmetric key
      const { value: metaAfterUntrustingTeammate } = await loadMetaConfig();

      expect(metaAfterUntrustingTeammate.teamMembers).toHaveProperty('default');
      expect(metaAfterUntrustingTeammate.encryptionKeys).toHaveProperty('default');
      expect((metaAfterUntrustingTeammate.teamMembers! as any).default).toHaveLength(1);
      expect((metaAfterUntrustingTeammate.encryptionKeys! as any).default).toHaveLength(2);
      expect(metaAfterUntrustingTeammate.teamMembers).toHaveProperty('production');
      expect(metaAfterUntrustingTeammate.encryptionKeys).toHaveProperty('production');
      expect((metaAfterUntrustingTeammate.teamMembers! as any).production).toHaveLength(1);
      expect((metaAfterUntrustingTeammate.encryptionKeys! as any).production).toHaveLength(1);

      // ensures that we can still encrypt/decrypt values
      const newlyEncryptedByUs = await encryptValue(
        'a secret value',
        await loadLatestSymmetricKey(privateKey),
      );
      await expect(
        decryptValue(newlyEncryptedByUs, await loadLatestSymmetricKey(privateKey)),
      ).resolves.toBe('a secret value');

      // now, the teammate should have no access
      await expect(loadLatestSymmetricKey(teammatePrivateKey)).rejects.toThrow();

      // just for test coverage, create a new symmetric key
      const latestSymmetricKey = await loadLatestSymmetricKey(privateKey);

      const newRevisionNumber = getRevisionNumber(latestSymmetricKey.revision) + 1;

      await saveNewSymmetricKey(
        await generateSymmetricKey(newRevisionNumber.toString()),
        await loadTeamMembers(),
      );

      const { value: metaAfterNewSymmetricKey } = await loadMetaConfig();

      expect(metaAfterNewSymmetricKey.teamMembers).toHaveProperty('default');
      expect(metaAfterNewSymmetricKey.encryptionKeys).toHaveProperty('default');
      expect((metaAfterNewSymmetricKey.teamMembers! as any).default).toHaveLength(1);
      expect((metaAfterNewSymmetricKey.encryptionKeys! as any).default).toHaveLength(3);
      expect(metaAfterNewSymmetricKey.teamMembers).toHaveProperty('production');
      expect(metaAfterNewSymmetricKey.encryptionKeys).toHaveProperty('production');
      expect((metaAfterNewSymmetricKey.teamMembers! as any).production).toHaveLength(1);
      expect((metaAfterNewSymmetricKey.encryptionKeys! as any).production).toHaveLength(1);

      // get out of the directory, Windows doesn't like unlink while cwd
      process.chdir(cwd);
    });
  });
});

describe('E2E Encrypted Repo', () => {
  it('sets up, trusts and untrusts users correctly', () => {
    const cwd = process.cwd();

    return withTempFiles({}, async (inDir) => {
      // run environmentless
      delete process.env.NODE_ENV;

      process.chdir(inDir('.'));
      process.env.APP_CONFIG_SECRETS_KEYCHAIN_FOLDER = inDir('keychain');

      const keys = await initializeKeysManually({
        name: 'Tester',
        email: 'test@example.com',
      });

      const dirs = {
        keychain: inDir('keychain'),
        privateKey: inDir('keychain/private-key.asc'),
        publicKey: inDir('keychain/public-key.asc'),
        revocationCert: inDir('keychain/revocation.asc'),
      };

      expect(await initializeLocalKeys(keys, dirs)).toEqual({
        publicKeyArmored: keys.publicKeyArmored,
      });

      const publicKey = await loadPublicKey();
      const privateKey = await loadPrivateKey();

      // this is what init-repo does
      await trustTeamMember(publicKey, privateKey);

      // at this point, we should have ourselves trusted, and 1 symmetric key
      const { value: meta } = await loadMetaConfig();

      expect(meta.teamMembers).toHaveProperty('default');
      expect(meta.encryptionKeys).toHaveProperty('default');
      expect((meta.teamMembers! as any).default).toHaveLength(1);
      expect((meta.encryptionKeys! as any).default).toHaveLength(1);

      const encryptionKey = await loadLatestSymmetricKey(privateKey);
      const encrypted = await encryptValue('a secret value', encryptionKey);
      await expect(decryptValue(encrypted, encryptionKey)).resolves.toBe('a secret value');

      const teammateKeys = await initializeKeysManually({
        name: 'A Teammate',
        email: 'teammate@example.com',
      });

      const teammatePublicKey = await loadPublicKey(teammateKeys.publicKeyArmored);
      const teammatePrivateKey = await loadPrivateKey(teammateKeys.privateKeyArmored);

      await trustTeamMember(teammatePublicKey, privateKey);

      // at this point, we should have 2 team members, but still 1 symmetric key
      const { value: metaAfterTrustingTeammate } = await loadMetaConfig();

      expect(metaAfterTrustingTeammate.teamMembers).toHaveProperty('default');
      expect(metaAfterTrustingTeammate.encryptionKeys).toHaveProperty('default');
      expect((metaAfterTrustingTeammate.teamMembers! as any).default).toHaveLength(2);
      expect((metaAfterTrustingTeammate.encryptionKeys! as any).default).toHaveLength(1);

      // ensures that the teammate can now encrypt/decrypt values
      const encryptedByTeammate = await encryptValue(
        'a secret value',
        await loadLatestSymmetricKey(teammatePrivateKey),
      );
      await expect(
        decryptValue(encryptedByTeammate, await loadLatestSymmetricKey(teammatePrivateKey)),
      ).resolves.toBe('a secret value');

      // ensures that we can still encrypt/decrypt values
      const encryptedByUs = await encryptValue(
        'a secret value',
        await loadLatestSymmetricKey(privateKey),
      );
      await expect(
        decryptValue(encryptedByUs, await loadLatestSymmetricKey(privateKey)),
      ).resolves.toBe('a secret value');

      await untrustTeamMember('teammate@example.com', privateKey);

      // at this point, we should have 1 team members, and a newly generated symmetric key
      const { value: metaAfterUntrustingTeammate } = await loadMetaConfig();

      expect(metaAfterUntrustingTeammate.teamMembers).toHaveProperty('default');
      expect(metaAfterUntrustingTeammate.encryptionKeys).toHaveProperty('default');
      expect((metaAfterUntrustingTeammate.teamMembers! as any).default).toHaveLength(1);
      expect((metaAfterUntrustingTeammate.encryptionKeys! as any).default).toHaveLength(2);

      // ensures that we can still encrypt/decrypt values
      const newlyEncryptedByUs = await encryptValue(
        'a secret value',
        await loadLatestSymmetricKey(privateKey),
      );
      await expect(
        decryptValue(newlyEncryptedByUs, await loadLatestSymmetricKey(privateKey)),
      ).resolves.toBe('a secret value');

      // now, the teammate should have no access
      await expect(loadLatestSymmetricKey(teammatePrivateKey)).rejects.toThrow();

      // just for test coverage, create a new symmetric key
      const latestSymmetricKey = await loadLatestSymmetricKey(privateKey);

      const newRevisionNumber = getRevisionNumber(latestSymmetricKey.revision) + 1;

      await saveNewSymmetricKey(
        await generateSymmetricKey(newRevisionNumber.toString()),
        await loadTeamMembers(),
      );

      const { value: metaAfterNewSymmetricKey } = await loadMetaConfig();

      expect(metaAfterNewSymmetricKey.teamMembers).toHaveProperty('default');
      expect(metaAfterNewSymmetricKey.encryptionKeys).toHaveProperty('default');
      expect((metaAfterNewSymmetricKey.teamMembers! as any).default).toHaveLength(1);
      expect((metaAfterNewSymmetricKey.encryptionKeys! as any).default).toHaveLength(3);

      // get out of the directory, Windows doesn't like unlink while cwd
      process.chdir(cwd);
    });
  });
});
