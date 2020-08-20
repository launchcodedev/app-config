import * as WS from 'ws';
import { nanoid } from 'nanoid';
import {
  loadPrivateKeyLazy,
  loadSymmetricKeysLazy,
  loadSymmetricKeyRaw,
  decryptTextRaw,
} from './secrets';

const port = 42938;

const msg = {
  secretToDecrypt: {
    into(secret: string, encryptedSymmetricKey: string): [string, string] {
      const id = nanoid();

      return [id, `DECRYPT#${id}#${encryptedSymmetricKey}#${secret}`];
    },
    from(encoded: string): [string, string, string] | undefined {
      const [, id, encryptedSymmetricKey, secret] = encoded.split('#');

      if (id && secret) {
        return [id, encryptedSymmetricKey, secret];
      }
    },
  },
  decryptedSecret: {
    into(id: string, raw: string) {
      return `DECRYPTED:${id}#${raw}`;
    },
    from(id: string, encoded: string): string | undefined {
      const prefix = `DECRYPTED:${id}#`;

      if (encoded.startsWith(prefix)) {
        return encoded.substr(prefix.length);
      }
    },
  },
};

let agentIsRunning = false;

export async function startAgent() {
  agentIsRunning = true;

  const privateKey = await loadPrivateKeyLazy();
  const websocket = new WS.Server({ port });

  let connections: WS[] = [];

  websocket.on('connection', ws => {
    connections.push(ws);

    ws.on('close', () => {
      connections = connections.filter(c => c !== ws);
    });

    async function handleReq(req: WS.Data) {
      if (typeof req === 'string') {
        const decoded = msg.secretToDecrypt.from(req);

        if (decoded) {
          const [id, encryptedSymmetricKey, secret] = decoded;
          const [, revision, base64] = secret.split(':');
          const revisionNum = parseFloat(revision);
          const { password } = await loadSymmetricKeyRaw(revisionNum, encryptedSymmetricKey);
          const decrypted = await decryptTextRaw(base64, password);

          ws.send(msg.decryptedSecret.into(id, decrypted));
        }
      }
    }

    ws.on('message', req => {
      handleReq(req).catch(err => {
        console.error(err);
      });
    });
  });

  console.log('Secret agent is listening');
}

let client: WS | undefined;
let clientDestroy: NodeJS.Timer | undefined;

export async function connectToAgentLazy(): Promise<WS | undefined> {
  // avoid connecting to itself when in 'agent mode'
  if (agentIsRunning) return undefined;

  if (clientDestroy) clearTimeout(clientDestroy);

  // if nobody requests a connection to the WS within 500ms, kill it
  clientDestroy = setTimeout(() => {
    client?.close();
  }, 500);

  if (client && client.readyState !== client.CLOSING && client.readyState !== client.CLOSED) {
    return client;
  }

  const conn = new WS(`ws://127.0.0.1:${port}`);

  conn.addEventListener('error', () => {});

  conn.addEventListener('close', () => {
    client = undefined;
  });

  return new Promise(resolve => {
    conn.addEventListener('error', () => resolve(undefined));
    conn.addEventListener('open', () => {
      client = conn;
      resolve(client);
    });
  });
}

export async function requestDecryption(client: WS, secret: string): Promise<string> {
  const [, revision] = secret.split(':');
  const revisionNum = parseFloat(revision);
  const encryptionKeys = await loadSymmetricKeysLazy();
  const found = encryptionKeys.find(k => k.revision === revisionNum);

  if (!found) {
    throw new Error(`No symmetric key ${revision} found`);
  }

  const [id, message] = msg.secretToDecrypt.into(secret, found.key);

  client.send(message);

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Secret agent timed out while decrypting')),
      1000,
    );

    const onMessage = (encoded: string) => {
      const decrypted = msg.decryptedSecret.from(id, encoded);

      if (decrypted) {
        resolve(decrypted);
        clearTimeout(timeout);
        client.removeListener('message', onMessage);
      }
    };

    client.on('message', onMessage);
  });
}
