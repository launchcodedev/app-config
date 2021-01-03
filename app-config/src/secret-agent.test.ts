import getPort from 'get-port';
import { resolve } from 'path';
import { startAgent, connectAgent } from './secret-agent';
import { Json, isWindows } from './common';
import {
  initializeKeysManually,
  generateSymmetricKey,
  encryptSymmetricKey,
  loadPrivateKey,
  encryptValue,
} from './encryption';

jest.setTimeout(30000);

describe('Decryption', () => {
  it('decrypts and encrypts values', async () => {
    const { privateKeyArmored } = await initializeKeysManually({
      name: 'Test',
      email: 'test@example.com',
    });

    const privateKey = await loadPrivateKey(privateKeyArmored);
    const symmetricKey = await generateSymmetricKey(1);
    const encryptedSymmetricKey = await encryptSymmetricKey(symmetricKey, [privateKey]);

    const port = await getPort();
    const server = await startAgent(port, privateKey);
    const client = await connectAgent(Infinity, port, async () => encryptedSymmetricKey);

    try {
      await client.ping();

      const values: Json[] = [
        'text',
        88.88,
        true,
        null,
        { value: 42 },
        { nested: { value: true } },
        [1, 2, 3],
        [{}, { b: true }, { c: true }],
      ];

      await Promise.all(
        values.map(async (value) => {
          const [encryptedLocally, encryptedRemotely] = await Promise.all([
            encryptValue(value, symmetricKey),
            client.encryptValue(value, encryptedSymmetricKey),
          ]);

          const [receivedLocal, receivedRemote] = await Promise.all([
            client.decryptValue(encryptedLocally),
            client.decryptValue(encryptedRemotely),
          ]);

          expect(receivedLocal).toEqual(value);
          expect(receivedRemote).toEqual(value);
        }),
      );
    } finally {
      await client.close();
      await server.close();
    }

    expect(client.isClosed()).toBe(true);
  });
});

describe('Unix Sockets', () => {
  it('connects using unix socket', async () => {
    if (isWindows) return;

    const { privateKeyArmored } = await initializeKeysManually({
      name: 'Test',
      email: 'test@example.com',
    });

    const privateKey = await loadPrivateKey(privateKeyArmored);
    const symmetricKey = await generateSymmetricKey(1);
    const encryptedSymmetricKey = await encryptSymmetricKey(symmetricKey, [privateKey]);

    const socket = resolve('./temporary-socket-file');
    const server = await startAgent(socket, privateKey);
    const client = await connectAgent(Infinity, socket, async () => encryptedSymmetricKey);

    try {
      await client.ping();

      const encrypted = await client.encryptValue({ foo: 'bar' }, encryptedSymmetricKey);
      const decrypted = await client.decryptValue(encrypted);

      expect(typeof encrypted).toBe('string');
      expect(decrypted).toEqual({ foo: 'bar' });
    } finally {
      await client.close();
      await server.close();
    }

    expect(client.isClosed()).toBe(true);
  });
});
