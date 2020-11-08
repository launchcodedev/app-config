import { SecretsRequireTTYError } from './errors';
import {
  initializeKeysManually,
  loadPrivateKey,
  loadPublicKey,
  generateSymmetricKey,
  encryptSymmetricKey,
  decryptSymmetricKey,
  encryptValue,
  decryptValue,
} from './encryption';
import './encryption-setup.test';

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
    const symmetricKey = await generateSymmetricKey(1);

    expect(symmetricKey.revision).toBe(1);
    expect(symmetricKey.key).toBeInstanceOf(Uint8Array);
    expect(symmetricKey.key.length).toBeGreaterThan(2048);
  });

  it('encrypts and decrypts a symmetric key', async () => {
    const privateKey = await createKey();
    const symmetricKey = await generateSymmetricKey(1);
    const encryptedKey = await encryptSymmetricKey(symmetricKey, [privateKey]);

    expect(encryptedKey.revision).toBe(1);
    expect(typeof encryptedKey.key).toBe('string');
    expect(encryptedKey.key.length).toBeGreaterThan(0);

    const decryptedKey = await decryptSymmetricKey(encryptedKey, privateKey);

    expect(decryptedKey.revision).toBe(1);
    expect(decryptedKey.key).toEqual(symmetricKey.key);
  });

  it('cannot decrypt a symmetric key that was created by someone else', async () => {
    const privateKey = await createKey();
    const someoneElsesKey = await createKey();

    const symmetricKey = await generateSymmetricKey(1);
    const encryptedKey = await encryptSymmetricKey(symmetricKey, [someoneElsesKey]);

    await expect(decryptSymmetricKey(encryptedKey, privateKey)).rejects.toThrow();
  });

  it('can decrypt a symmetric key from multiple private keys', async () => {
    const privateKey = await createKey();
    const someoneElsesKey = await createKey();

    const symmetricKey = await generateSymmetricKey(1);
    const encryptedKey = await encryptSymmetricKey(symmetricKey, [privateKey, someoneElsesKey]);

    await expect(decryptSymmetricKey(encryptedKey, privateKey)).resolves.toEqual(symmetricKey);
    await expect(decryptSymmetricKey(encryptedKey, someoneElsesKey)).resolves.toEqual(symmetricKey);
  });

  it('can re-encrypt a key that was previously only for one person', async () => {
    const privateKey = await createKey();
    const someoneElsesKey = await createKey();

    const symmetricKey = await generateSymmetricKey(1);
    const encryptedKey = await encryptSymmetricKey(symmetricKey, [privateKey]);
    const decryptedKey = await decryptSymmetricKey(encryptedKey, privateKey);
    const encryptedKey2 = await encryptSymmetricKey(decryptedKey, [privateKey, someoneElsesKey]);
    const decryptedKey2 = await decryptSymmetricKey(encryptedKey2, someoneElsesKey);

    expect(decryptedKey).toEqual(symmetricKey);
    expect(decryptedKey2).toEqual(symmetricKey);
  });

  it('validates encoded revision number in keys', async () => {
    const privateKey = await createKey();
    const symmetricKey = await generateSymmetricKey(1);
    const encryptedKey = await encryptSymmetricKey(symmetricKey, [privateKey]);

    // really go out of our way to mess with the key - this usually results in integrity check failures either way
    const ind = encryptedKey.key.indexOf('\r\n\r\n') + 4;
    const rev = String.fromCharCode(encryptedKey.key.charCodeAt(ind) + 1);
    encryptedKey.key = encryptedKey.key.slice(0, ind) + rev + encryptedKey.key.slice(ind + 1);

    await expect(decryptSymmetricKey(encryptedKey, privateKey)).rejects.toThrow();
  });
});

describe('Value Encryption', () => {
  it('encrypts and decrypts a simple value', async () => {
    const value = 'hello world';
    const symmetricKey = await generateSymmetricKey(1);
    const encrypted = await encryptValue(value, symmetricKey);
    const decrypted = await decryptValue(encrypted, symmetricKey);

    expect(typeof encrypted).toEqual('string');
    expect(encrypted).toMatch(/^enc:1:/);
    expect(decrypted).toEqual(value);
  });

  it('encrypts and decrypts a JSON object', async () => {
    const value = { message: 'hello world', nested: {} };
    const symmetricKey = await generateSymmetricKey(1);
    const encrypted = await encryptValue(value, symmetricKey);
    const decrypted = await decryptValue(encrypted, symmetricKey);

    expect(typeof encrypted).toEqual('string');
    expect(encrypted).toMatch(/^enc:1:/);
    expect(decrypted).toEqual(value);
  });

  it('cannot decrypt a value with the wrong key', async () => {
    const value = 'hello world';
    const symmetricKey = await generateSymmetricKey(1);
    const wrongKey = await generateSymmetricKey(1);
    const encrypted = await encryptValue(value, symmetricKey);

    await expect(decryptValue(encrypted, wrongKey)).rejects.toThrow();
  });
});
