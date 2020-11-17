import https from 'https';
import { join } from 'path';
import { readFile } from 'fs-extra';
import WebSocket from 'ws';
import { Server as BaseServer, Client as BaseClient, MessageVariant } from '@lcdev/ws-rpc/bson';
import { Json } from './common';
import {
  Key,
  decryptValue,
  loadSymmetricKeys,
  loadPrivateKeyLazy,
  decryptSymmetricKey,
  EncryptedSymmetricKey,
} from './encryption';
import { AppConfigError } from './errors';
import { logger } from './logging';

const selfSignedCert = join(__dirname, '..', 'secret-agent-cert.pem');
const selfSignedCertKey = join(__dirname, '..', 'secret-agent-key.pem');

export enum MessageType {
  Ping = 'Ping',
  Decrypt = 'Decrypt',
}

export type Messages = {
  [MessageType.Ping]: MessageVariant<MessageType.Ping, void, void>;
  [MessageType.Decrypt]: MessageVariant<
    MessageType.Decrypt,
    {
      text: string;
      symmetricKey: EncryptedSymmetricKey;
    },
    Json
  >;
};

export type EventType = never;
export type Events = never;

export class Client extends BaseClient<MessageType, EventType, Messages, Events> {}
export class Server extends BaseServer<MessageType, EventType, Messages, Events> {}

export async function startAgent(port: number = 42938, privateKeyOverride?: Key): Promise<Server> {
  let privateKey: Key;

  if (privateKeyOverride) {
    privateKey = privateKeyOverride;
  } else {
    privateKey = await loadPrivateKeyLazy();
  }

  logger.info(`Starting secret-agent, listening on port ${port}`);

  const httpsServer = https.createServer({
    cert: await readFile(selfSignedCert),
    key: await readFile(selfSignedCertKey),
  });

  const server = new Server(new WebSocket.Server({ server: httpsServer }));

  server.registerHandler(MessageType.Ping, () => {});

  server.registerHandler(MessageType.Decrypt, async ({ text, symmetricKey }) => {
    const key = await decryptSymmetricKey(symmetricKey, privateKey);
    const decoded = await decryptValue(text, key);

    return decoded;
  });

  httpsServer.listen(port);

  const superClose = server.close.bind(server);

  Object.assign(server, {
    async close() {
      await superClose();

      // we have to close the http server ourselves, because it was created manually
      await new Promise<void>((resolve, reject) =>
        httpsServer.close((err) => {
          if (err) reject(err);
          else resolve();
        }),
      );
    },
  });

  return server;
}

export async function connectAgent(
  closeTimeoutMs = Infinity,
  port: number = 42938,
  loadEncryptedKey: typeof loadSymmetricKey = loadSymmetricKey,
) {
  logger.verbose(`Connecting to secret-agent on port ${port}`);

  const client = new Client(
    new WebSocket(`wss://localhost:${port}`, {
      ca: await readFile(selfSignedCert),
    }),
  );

  await client.waitForConnection();

  let isClosed = false;
  let closeTimeout: NodeJS.Timeout;

  client.onClose(() => {
    isClosed = true;
  });

  const keepAlive = () => {
    if (closeTimeout) clearTimeout(closeTimeout);
    if (closeTimeoutMs === Infinity) return;

    closeTimeout = setTimeout(() => {
      logger.verbose('Closing websocket');

      client.close().finally(() => {
        logger.verbose('Client was closed');
      });
    }, closeTimeoutMs);
  };

  return {
    close() {
      return client.close();
    },
    isClosed() {
      return isClosed;
    },
    async ping() {
      keepAlive();

      await client.call(MessageType.Ping, undefined);
    },
    async decryptValue(text: string) {
      keepAlive();

      const revision = parseFloat(text.split(':')[1]);
      const symmetricKey = await loadEncryptedKey(revision);
      const decrypted = await client.call(MessageType.Decrypt, { text, symmetricKey });

      keepAlive();

      return decrypted;
    },
  } as const;
}

const clients = new Map<number, ReturnType<typeof connectAgent>>();

export async function connectAgentLazy(
  closeTimeoutMs = 500,
  port: number = 42938,
): ReturnType<typeof connectAgent> {
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

async function loadSymmetricKey(revision: number): Promise<EncryptedSymmetricKey> {
  const symmetricKeys = await loadSymmetricKeys(true);
  const symmetricKey = symmetricKeys.find((k) => k.revision === revision);

  if (!symmetricKey) throw new AppConfigError(`Could not find symmetric key ${revision}`);

  return symmetricKey;
}
