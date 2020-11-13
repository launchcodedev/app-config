import { Server as BaseServer, Client as BaseClient, MessageVariant } from '@lcdev/ws-rpc/bson';
import { Json } from './common';
import {
  decryptValue,
  loadSymmetricKeys,
  loadPrivateKeyLazy,
  decryptSymmetricKey,
  EncryptedSymmetricKey,
} from './encryption';
import { AppConfigError } from './errors';
import { logger } from './logging';

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

export async function startAgent(port: number = 42938): Promise<Server> {
  const privateKey = await loadPrivateKeyLazy();

  logger.info(`Starting secret-agent, listening on port ${port}`);

  const server = new Server(port);

  server.registerHandler(MessageType.Ping, () => {});

  server.registerHandler(MessageType.Decrypt, async ({ text, symmetricKey }) => {
    const key = await decryptSymmetricKey(symmetricKey, privateKey);
    const decoded = await decryptValue(text, key);

    return decoded;
  });

  return server;
}

export async function connectAgent(closeTimeoutMs = Infinity, port: number = 42938) {
  logger.verbose(`Connecting to secret-agent on port ${port}`);

  const client = new Client('localhost', port);

  await client.waitForConnection();

  let isClosed = false;
  let closeTimeout: NodeJS.Timeout;

  client.onClose(() => {
    isClosed = true;
  });

  const keepAlive = () => {
    if (closeTimeout) clearTimeout(closeTimeout);

    closeTimeout = setTimeout(() => {
      logger.verbose('Closing websocket');

      client.close().finally(() => {
        logger.verbose('Client was closed');
      });
    }, closeTimeoutMs);
  };

  return {
    isClosed() {
      return isClosed;
    },
    async decryptValue(text: string) {
      keepAlive();

      const revision = parseFloat(text.split(':')[1]);
      const symmetricKeys = await loadSymmetricKeys(true);
      const symmetricKey = symmetricKeys.find((k) => k.revision === revision);

      if (!symmetricKey) throw new AppConfigError();

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

let useSecretAgent = true;

export function shouldUseSecretAgent(value?: boolean) {
  if (value !== undefined) {
    useSecretAgent = value;
  }

  return useSecretAgent;
}
