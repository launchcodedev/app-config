import { AppConfigError, ParsingExtension } from '@app-config/core';
import { named } from '@app-config/extension-utils';
import { logger } from '@app-config/logging';
import { environmentOptionsFromContext } from '@app-config/node';
import { DecryptedSymmetricKey, decryptValue } from './encryption';

export * from './encryption';
export * from './secret-agent';
export * from './secret-agent-tls';

/** Decrypts inline encrypted values */
export default function encryptedDirective(
  symmetricKey?: DecryptedSymmetricKey,
  shouldShowDeprecationNotice?: true,
): ParsingExtension {
  return named('encryption', (value, _, __, ctx) => {
    if (typeof value === 'string' && value.startsWith('enc:')) {
      return async (parse) => {
        if (shouldShowDeprecationNotice) {
          logger.warn(
            'Detected deprecated use of @app-config/encryption parsing extension. Please install @app-config/encryption and add it to your meta file "parsingExtensions".',
          );
        }

        // we override the environment with what's specified in the key revision
        // so you can use the same key for multiple environments

        const revision = value.split(':')[1];

        if (!revision) {
          throw new AppConfigError(`Could not find key revision in encrypted value`);
        }

        const envRegex = /^(?:(?<env>\w*)-)?(?:\d+)$/;
        const env = envRegex.exec(revision)?.groups?.env;
        const environmentOptions = environmentOptionsFromContext(ctx);

        if (env && environmentOptions) {
          environmentOptions.override = env;
        }

        const decrypted = await decryptValue(
          value,
          symmetricKey,
          env ? environmentOptions : undefined,
        );

        return parse(decrypted, { fromSecrets: true, parsedFromEncryptedValue: true });
      };
    }

    return false;
  });
}
