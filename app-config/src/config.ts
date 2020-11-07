import { Json, isObject } from './common';
import { ParsedValue } from './parsed-value';
import { FlexibleFileSource, EnvironmentSource, NotFoundError } from './config-source';
import { defaultExtensions, FileParsingExtension } from './extensions';
import { loadSchema } from './schema';

export interface Configuration {
  /** full configuration plain JSON, with secrets and nonSecrets */
  fullConfig: Json;
  /** parsed configuration value, with metadata (like ConfigSource) still attached */
  parsed: ParsedValue;
  parsedSecrets?: ParsedValue;
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
    return { parsed, fullConfig: parsed.toJSON() };
  } catch (error) {
    // having no APP_CONFIG environment variable is normal, and should fall through to reading files
    if (!(error instanceof NotFoundError)) throw error;
  }

  const [nonSecrets, secrets] = await Promise.all([
    new FlexibleFileSource(fileName, environmentOverride).read(defaultExtensions),
    new FlexibleFileSource(`${fileName}.secrets`, environmentOverride)
      .read(defaultExtensions.concat(markAllValuesAsSecret))
      .catch((error) => {
        // NOTE: secrets are optional, so not finding them is normal
        if (error instanceof NotFoundError) return undefined;

        throw error;
      }),
  ]);

  const parsed = secrets ? ParsedValue.merge(nonSecrets, secrets) : nonSecrets;

  return {
    parsed,
    parsedSecrets: secrets,
    parsedNonSecrets: nonSecrets,
    fullConfig: parsed.toJSON(),
  };
}

export async function loadValidatedConfig(
  fileName = '.app-config',
  environmentVariableName = 'APP_CONFIG',
  environmentOverride?: string,
): Promise<Configuration> {
  const [{ validate }, { fullConfig, parsed, ...rest }] = await Promise.all([
    loadSchema(),
    loadConfig(fileName, environmentVariableName, environmentOverride),
  ]);

  if (!isObject(fullConfig)) throw new Error('Config was not an object');
  validate(fullConfig, parsed);

  return { fullConfig, parsed, ...rest };
}

const markAllValuesAsSecret: FileParsingExtension = (_, value) => () => [
  value,
  { metadata: { fromSecrets: true } },
];
