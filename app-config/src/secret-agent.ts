import https from 'https';
import WebSocket from 'ws';
import { build } from '@lcdev/ws-rpc';
import bsonSerialization from '@lcdev/ws-rpc/bson';
import { Json } from './common';
import {
  Key,
  decryptValue,
  encryptValue,
  loadSymmetricKeys,
  loadPrivateKeyLazy,
  decryptSymmetricKey,
  EncryptedSymmetricKey,
} from './encryption';
import { loadOrCreateCert } from './secret-agent-tls';
import { loadSettingsLazy, saveSettings } from './settings';
import { AppConfigError } from './errors';
import { logger } from './logging';

const common = build(bsonSerialization)
  .func<'Ping'>()
  .func<'Decrypt', { text: string; symmetricKey: EncryptedSymmetricKey }, Json>()
  .func<'Encrypt', { value: Json; symmetricKey: EncryptedSymmetricKey }, string>();

export type Server = typeof common.Connection;
export type Client = typeof common.Connection;

export async function startAgent(portOverride?: number, privateKeyOverride?: Key): Promise<Server> {
  let privateKey: Key;

  if (privateKeyOverride) {
    privateKey = privateKeyOverride;
  } else {
    privateKey = await loadPrivateKeyLazy();
  }

  const port = await getAgentPort(portOverride);

  logger.info(`Starting secret-agent, listening on port ${port}`);

  const { cert, key } = await loadOrCreateCert();
  const httpsServer = https.createServer({ cert, key });

  const server = common
    .server({
      async Ping() {},
      async Decrypt({ text, symmetricKey }) {
        logger.verbose(`Decrypting a secret for a key rev:${symmetricKey.revision}`);

        const decoded = await decryptValue(
          text,
          await decryptSymmetricKey(symmetricKey, privateKey),
        );

        return decoded;
      },
      async Encrypt({ value, symmetricKey }) {
        logger.verbose(`Encrypting a secret value with key rev:${symmetricKey.revision}`);

        const encoded = await encryptValue(
          value,
          await decryptSymmetricKey(symmetricKey, privateKey),
        );

        return encoded;
      },
    })
    .listen(httpsServer);

  httpsServer.listen(port);

  return server;
}

export async function connectAgent(
  closeTimeoutMs = Infinity,
  portOverride?: number,
  loadEncryptedKey: typeof loadSymmetricKey = loadSymmetricKey,
) {
  const port = await getAgentPort(portOverride);

  logger.verbose(`Connecting to secret-agent on port ${port}`);

  const { cert } = await loadOrCreateCert();

  const client = await common
    .client()
    .connect(new WebSocket(`wss://localhost:${port}`, { ca: [cert] }));

  let isClosed = false;
  let closeTimeout: NodeJS.Timeout;

  client.onClose(() => {
    isClosed = true;
  });

  const keepAlive = () => {
    if (closeTimeout) global.clearTimeout(closeTimeout);
    if (closeTimeoutMs === Infinity) return;

    closeTimeout = global.setTimeout(() => {
      logger.verbose('Closing websocket');

      client.close().finally(() => {
        logger.verbose('Client was closed');
      });
    }, closeTimeoutMs);
  };

  return {
    close() {
      isClosed = true;
      return client.close();
    },
    isClosed() {
      return isClosed;
    },
    async ping() {
      keepAlive();

      await client.ping();
    },
    async decryptValue(text: string) {
      keepAlive();

      const revision = text.split(':')[1];
      const revisionNumber = parseFloat(revision);

      if (Number.isNaN(revisionNumber)) {
        throw new AppConfigError(
          `Encrypted value was invalid, revision was not a number (${revision})`,
        );
      }

      const symmetricKey = await loadEncryptedKey(revisionNumber);
      const decrypted = await client.Decrypt({ text, symmetricKey });

      keepAlive();

      return decrypted;
    },
    async encryptValue(value: Json, symmetricKey: EncryptedSymmetricKey) {
      keepAlive();

      const encoded = await client.Encrypt({ value, symmetricKey });

      keepAlive();

      return encoded;
    },
  } as const;
}

const clients = new Map<number, ReturnType<typeof connectAgent>>();

export async function connectAgentLazy(
  closeTimeoutMs = 500,
  portOverride?: number,
): ReturnType<typeof connectAgent> {
  const port = await getAgentPort(portOverride);

  if (!clients.has(port)) {
    const connection = connectAgent(closeTimeoutMs, port);

    clients.set(port, connection);

    return connection;
  }

  const connection = await clients.get(port)!;

  // re-connect
  if (connection.isClosed()) {
    clients.delete(port);

    return connectAgentLazy(closeTimeoutMs, port);
  }

  return connection;
}

export async function disconnectAgents() {
  for (const [port, client] of clients.entries()) {
    clients.delete(port);
    await client.then(
      (c) => c.close(),
      () => {},
    );
  }
}

let useSecretAgent = true;

export function shouldUseSecretAgent(value?: boolean) {
  if (value !== undefined) {
    useSecretAgent = value;
  }

  return useSecretAgent;
}

const defaultPort = 42938;

async function getAgentPort(portOverride?: number) {
  if (portOverride !== undefined) {
    return portOverride;
  }
  const settings = await loadSettingsLazy();

  if (settings.secretAgent?.port) {
    return settings.secretAgent.port;
  }
  if (settings.secretAgent) {
    await saveSettings({
      ...settings,
      secretAgent: {
        ...settings.secretAgent,
        port: defaultPort,
      },
    });
  }

  return defaultPort;
}

async function loadSymmetricKey(revision: number): Promise<EncryptedSymmetricKey> {
  const symmetricKeys = await loadSymmetricKeys(true);
  const symmetricKey = symmetricKeys.find((k) => k.revision === revision);

  if (!symmetricKey) throw new AppConfigError(`Could not find symmetric key ${revision}`);

  return symmetricKey;
}
