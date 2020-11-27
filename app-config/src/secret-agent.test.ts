import getPort from 'get-port';
import { startAgent, connectAgent } from './secret-agent';
import { Json } from './common';
import {
  initializeKeysManually,
  generateSymmetricKey,
  encryptSymmetricKey,
  loadPrivateKey,
  encryptValue,
} from './encryption';

jest.setTimeout(15000);

describe('Decryption', () => {
  it('decrypts values', async () => {
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
  });
});
