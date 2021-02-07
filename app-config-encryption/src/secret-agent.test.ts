import getPort from 'get-port';
import { resolve } from 'path';
import { Json, isWindows } from '@app-config/utils';
import { saveSettings } from '@app-config/settings';
import { withTempFiles } from '@app-config/test-utils';
import {
  startAgent,
  connectAgent,
  getAgentPortOrSocket,
  shouldUseSecretAgent,
} from './secret-agent';
import { loadOrCreateCert } from './secret-agent-tls';
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

describe('shouldUseSecretAgent', () => {
  it('sets and retrieves value', () => {
    shouldUseSecretAgent(true);
    expect(shouldUseSecretAgent()).toBe(true);
    shouldUseSecretAgent(false);
    expect(shouldUseSecretAgent()).toBe(false);
  });
});

describe('getAgentPortOrSocket', () => {
  it('loads agent port from settings', () =>
    withTempFiles({}, async (inDir) => {
      process.env.APP_CONFIG_SETTINGS_FOLDER = inDir('settings');

      const { cert, key, expiry } = await loadOrCreateCert();
      await saveSettings({ secretAgent: { port: 1111, cert, key, expiry } });
      await expect(getAgentPortOrSocket()).resolves.toBe(1111);
      await saveSettings({ secretAgent: { socket: './foo', cert, key, expiry } });
      await expect(getAgentPortOrSocket()).resolves.toBe('./foo');
    }));
});
