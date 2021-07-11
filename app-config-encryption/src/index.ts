import type { ParsingExtension } from '@app-config/core';
import { named } from '@app-config/extension-utils';
import { DecryptedSymmetricKey, decryptValue } from './encryption';

export * from './encryption';
export * from './secret-agent';
export * from './secret-agent-tls';

/** Decrypts inline encrypted values */
export default function encryptedDirective(symmetricKey?: DecryptedSymmetricKey): ParsingExtension {
  return named('encryption', (value) => {
    if (typeof value === 'string' && value.startsWith('enc:')) {
      return async (parse) => {
        const decrypted = await decryptValue(value, symmetricKey);

        return parse(decrypted, { fromSecrets: true, parsedFromEncryptedValue: true });
      };
    }

    return false;
  });
}
