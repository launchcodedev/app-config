import { loadSettingsLazy, saveSettings } from '@app-config/settings';
import { logger } from '@app-config/logging';

interface SelfSigned {
  generate(
    attributes: object[],
    options: object,
    cb: (err?: Error, pem?: { private: string; public: string; cert: string }) => void,
  ): void;
}

/* eslint-disable-next-line global-require */
const selfsigned = require('selfsigned') as SelfSigned;

export interface Cert {
  key: string;
  cert: string;
  expiry: string;
}

export async function generateCert(expireInDays: number = 365 * 10): Promise<Cert> {
  const expiry = new Date();

  expiry.setDate(expiry.getDate() + expireInDays - 2);
  expiry.setHours(0);
  expiry.setMinutes(0);
  expiry.setSeconds(0);
  expiry.setMilliseconds(0);

  logger.info(`Creating a self-signed certificate that expires in ${expireInDays} days`);

  return new Promise<Cert>((resolve, reject) => {
    selfsigned.generate(
      [{ name: 'commonName', value: 'localhost' }],
      {
        days: expireInDays,
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
      (err, pem) => {
        if (err) return reject(err);

        resolve({ key: pem!.private, cert: pem!.cert, expiry: expiry.toISOString() });
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
