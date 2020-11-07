import merge from 'lodash.merge';
import { JsonObject, isObject } from './common';
import { ParsedValue } from './parsed-value';
import { FlexibleFileSource, EnvironmentSource, NotFoundError } from './config-source';
import { loadSchema } from './schema';

export interface Configuration {
  /** actual parsed and transformed JSON */
  fullConfig: JsonObject;

  /** properties that were specifically parsed as "secrets" */
  parsedSecrets?: ParsedValue;
  /** properties that were specifically parsed as non-"secrets" */
  parsedNonSecrets?: ParsedValue;
}

export async function loadConfig(
  fileName = '.app-config',
  environmentVariableName = 'APP_CONFIG',
  environmentOverride?: string,
): Promise<Configuration> {
  // before trying to read .app-config files, we check for the APP_CONFIG environment variable
  const env = new EnvironmentSource(environmentVariableName);

  try {
    const parsed = await env.read();
    const fullConfig = parsed.toJSON();

    if (!isObject(fullConfig)) throw new Error('Config was not an object');

    return {
      fullConfig,
    };
  } catch (error) {
    // having no APP_CONFIG environment variable is normal, and should fall through to reading files
    if (!(error instanceof NotFoundError)) throw error;
  }

  const source = new FlexibleFileSource(fileName, environmentOverride);
  const secretsSource = new FlexibleFileSource(`${fileName}.secrets`, environmentOverride);

  const [nonSecrets, secrets] = await Promise.all([
    source.read(),
    secretsSource.read().catch((error) => {
      // NOTE: secrets are optional, so not finding them is normal
      if (error instanceof NotFoundError) return undefined;

      throw error;
    }),
  ]);

  const nonSecretsValue = nonSecrets.toJSON();
  const secretsValue = secrets?.toJSON();

  if (!isObject(nonSecretsValue)) throw new Error('Config was not an object');
  if (secretsValue && !isObject(secretsValue)) throw new Error('Config was not an object');

  return {
    parsedSecrets: secrets,
    parsedNonSecrets: nonSecrets,
    fullConfig: merge({}, nonSecretsValue, secretsValue),
  };
}

export async function loadValidatedConfig(
  fileName = '.app-config',
  environmentVariableName = 'APP_CONFIG',
  environmentOverride?: string,
): Promise<Configuration> {
  const [{ validate }, { fullConfig, parsedSecrets, parsedNonSecrets }] = await Promise.all([
    loadSchema(),
    loadConfig(fileName, environmentVariableName, environmentOverride),
  ]);

  validate(fullConfig, parsedNonSecrets);

  return { fullConfig, parsedSecrets, parsedNonSecrets };
}
