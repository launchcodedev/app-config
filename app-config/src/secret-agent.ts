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

export async function startAgent(
  socketOrPortOverride?: number | string,
  privateKeyOverride?: Key,
): Promise<Server> {
  let privateKey: Key;

  if (privateKeyOverride) {
    privateKey = privateKeyOverride;
  } else {
    privateKey = await loadPrivateKeyLazy();
  }

  const socketOrPort = await getAgentPortOrSocket(socketOrPortOverride);

  const server = common.server({
    async Ping() {},
    async Decrypt({ text, symmetricKey }) {
      logger.verbose(`Decrypting a secret for a key rev:${symmetricKey.revision}`);

      const decoded = await decryptValue(text, await decryptSymmetricKey(symmetricKey, privateKey));

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
  });

  if (typeof socketOrPort === 'number') {
    logger.info(`Starting secret-agent, listening on port ${socketOrPort}`);

    const { cert, key } = await loadOrCreateCert();
    const httpsServer = https.createServer({ cert, key });

    httpsServer.listen(socketOrPort);

    return server.listen(httpsServer);
  }

  logger.info(`Starting secret-agent, listening on socket ${socketOrPort}`);

  return server.listen({ socket: socketOrPort });
}

export async function connectAgent(
  closeTimeoutMs = Infinity,
  socketOrPortOverride?: number | string,
  loadEncryptedKey: typeof loadSymmetricKey = loadSymmetricKey,
) {
  let client: Client;

  const socketOrPort = await getAgentPortOrSocket(socketOrPortOverride);

  if (typeof socketOrPort === 'number') {
    logger.verbose(`Connecting to secret-agent on port ${socketOrPort}`);

    const { cert } = await loadOrCreateCert();

    client = await common
      .client()
      .connect(new WebSocket(`wss://localhost:${socketOrPort}`, { ca: [cert] }));
  } else {
    client = await common.client().connect(new WebSocket(`ws+unix://${socketOrPort}`));
  }

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

const clients = new Map<number | string, ReturnType<typeof connectAgent>>();

export async function connectAgentLazy(
  closeTimeoutMs = 500,
  socketOrPortOverride?: number | string,
): ReturnType<typeof connectAgent> {
  const socketOrPort = await getAgentPortOrSocket(socketOrPortOverride);

  if (!clients.has(socketOrPort)) {
    const connection = connectAgent(closeTimeoutMs, socketOrPort);

    clients.set(socketOrPort, connection);

    return connection;
  }

  const connection = await clients.get(socketOrPort)!;

  // re-connect
  if (connection.isClosed()) {
    clients.delete(socketOrPort);

    return connectAgentLazy(closeTimeoutMs, socketOrPort);
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

async function getAgentPortOrSocket(
  socketOrPortOverride?: number | string,
): Promise<number | string> {
  if (socketOrPortOverride !== undefined) {
    return socketOrPortOverride;
  }

  const settings = await loadSettingsLazy();

  if (settings.secretAgent?.socket) {
    return settings.secretAgent.socket;
  }

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
