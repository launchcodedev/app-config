import { ParsingExtension } from '@app-config/core';
import { named } from '@app-config/extension-utils';
import { logger } from '@app-config/logging';
import { DecryptedSymmetricKey, decryptValue } from './encryption';

export * from './encryption';
export * from './secret-agent';
export * from './secret-agent-tls';

/** Decrypts inline encrypted values */
export default function encryptedDirective(
  symmetricKey?: DecryptedSymmetricKey,
  shouldShowDeprecationNotice?: true,
): ParsingExtension {
  return named('encryption', (value) => {
    if (typeof value === 'string' && value.startsWith('enc:')) {
      return async (parse) => {
        if (shouldShowDeprecationNotice) {
          logger.warn(
            'Detected deprecated use of @app-config/encryption parsing extension. Please install @app-config/encryption and add it to your meta file "parsingExtensions".',
          );
        }

        // we don't need to pass the environment here - we use the key revision
        // to determine which symmetric key to use
        const decrypted = await decryptValue(value, symmetricKey);

        return parse(decrypted, { fromSecrets: true, parsedFromEncryptedValue: true });
      };
    }

    return false;
  });
}
