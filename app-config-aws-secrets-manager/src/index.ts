import type { ParsingExtension, Json } from '@app-config/main';
import { named, forKey, validateOptions } from '@app-config/extension-utils';
import { SecretsManager } from '@aws-sdk/client-secrets-manager';
import { markAllValuesAsSecret } from '@app-config/extensions';

function awsSecretsManagerParsingExtension(): ParsingExtension {
  return named(
    '$awsSecretsManager',
    forKey(
      '$awsSecretsManager',
      validateOptions(
        (SchemaBuilder) =>
          SchemaBuilder.emptySchema().addString('secretId').addString('select', {}, false),
        ({ secretId, select }) =>
          async (parse) => {
            const client = new SecretsManager();
            const secret = await client.getSecretValue({ SecretId: secretId });

            if (!secret.SecretString) {
              throw new Error(`Secret ID ${secretId} not found in AWS Secrets Manager`);
            }

            let value = secret.SecretString as Json;

            if (select) {
              const json = JSON.parse(secret.SecretString) as Record<string, Json>;
              value = json[select];

              if (!value) {
                throw new Error(
                  `Could not select ${select} JSON key from Secret ID ${secretId} in AWS Secrets Manager`,
                );
              }
            }

            return parse(value, { shouldFlatten: true }, undefined, [markAllValuesAsSecret()]);
          },
      ),
    ),
  );
}

export default awsSecretsManagerParsingExtension;
