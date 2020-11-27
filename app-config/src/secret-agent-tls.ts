import { logger } from './logging';
import { loadSettingsLazy, saveSettings } from './settings';

interface SelfSigned {
  generate(
    attributes: object[],
    options: object,
    cb: (err: Error, pem: { private: string; public: string; cert: string }) => void,
  ): void;
}

/* eslint-disable-next-line global-require */
const selfsigned = require('selfsigned') as SelfSigned;

export interface Cert {
  key: string;
  cert: string;
  expiry: string;
}

export async function generateCert(): Promise<Cert> {
  const expireIn = 365 * 10;
  const expiry = new Date();

  expiry.setDate(expiry.getDate() + expireIn - 2);
  expiry.setHours(0);
  expiry.setMinutes(0);
  expiry.setSeconds(0);
  expiry.setMilliseconds(0);

  logger.info(`Creating a self-signed certificate that expires in ${expireIn} days`);

  return new Promise<Cert>((resolve, reject) => {
    selfsigned.generate(
      [{ name: 'commonName', value: 'localhost' }],
      {
        days: expireIn,
        algorithm: 'sha256',
        keySize: 2048,
        extensions: [
          {
            name: 'keyUsage',
            keyCertSign: true,
            digitalSignature: true,
            nonRepudiation: true,
            keyEncipherment: true,
            dataEncipherment: true,
          },
          {
            name: 'extKeyUsage',
            serverAuth: true,
            clientAuth: true,
            codeSigning: true,
            timeStamping: true,
          },
          {
            name: 'subjectAltName',
            altNames: [
              {
                type: 2,
                value: 'localhost',
              },
              {
                type: 2,
                value: 'localhost.localdomain',
              },
              {
                type: 2,
                value: '[::1]',
              },
              {
                type: 7,
                ip: '127.0.0.1',
              },
              {
                type: 7,
                ip: 'fe80::1',
              },
            ],
          },
        ],
      },
      (err, { private: key, cert }) => {
        if (err) return reject(err);

        resolve({ key, cert, expiry: expiry.toISOString() });
      },
    );
  });
}

export async function loadOrCreateCert(): Promise<Cert> {
  const settings = await loadSettingsLazy();

  if (settings.secretAgent) {
    // TODO: check expiry
    return settings.secretAgent;
  }

  const generated = await generateCert();

  await saveSettings({ ...settings, secretAgent: { ...generated } });

  return generated;
}
