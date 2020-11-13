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

    for (const value of values) {
      const encryptedValue = await encryptValue(value, symmetricKey);
      const received = await client.decryptValue(encryptedValue);

      expect(received).toEqual(value);
    }

    client.close();
    server.close();
  });
});
