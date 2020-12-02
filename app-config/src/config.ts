import { join } from 'path';
import { Json, isObject } from './common';
import { ParsedValue, ParsingExtension } from './parsed-value';
import { defaultAliases, EnvironmentAliases } from './environment';
import { FlexibleFileSource, FileSource, EnvironmentSource, FallbackSource } from './config-source';
import { defaultExtensions, defaultEnvExtensions, markAllValuesAsSecret } from './extensions';
import { loadSchema, Options as SchemaOptions } from './schema';
import { NotFoundError, WasNotObject, ReservedKeyError } from './errors';
import { logger } from './logging';

export interface Options {
  directory?: string;
  schemaDirectory?: string;
  fileNameBase?: string;
  secretsFileNameBase?: string;
  environmentVariableName?: string;
  extensionEnvironmentVariableNames?: string[];
  environmentOverride?: string;
  environmentAliases?: EnvironmentAliases;
  parsingExtensions?: ParsingExtension[];
  secretsFileExtensions?: ParsingExtension[];
  environmentExtensions?: ParsingExtension[];
  defaultValues?: Json;
}

export interface Configuration {
  /** full configuration plain JSON, with secrets and nonSecrets */
  fullConfig: Json;
  /** parsed configuration value, with metadata (like ConfigSource) still attached */
  parsed: ParsedValue;
  parsedSecrets?: ParsedValue;
  parsedNonSecrets?: ParsedValue;
  /** non-exhaustive list of files that were read (useful for reloading in plugins) */
  filePaths?: string[];
}

export async function loadConfig({
  directory = '.',
  fileNameBase = '.app-config',
  secretsFileNameBase = `${fileNameBase}.secrets`,
  environmentVariableName = 'APP_CONFIG',
  extensionEnvironmentVariableNames = ['APP_CONFIG_EXTEND', 'APP_CONFIG_CI'],
  environmentOverride,
  environmentAliases = defaultAliases,
  parsingExtensions = defaultExtensions(environmentAliases, environmentOverride),
  secretsFileExtensions = parsingExtensions.concat(markAllValuesAsSecret()),
  environmentExtensions = defaultEnvExtensions(),
  defaultValues,
}: Options = {}): Promise<Configuration> {
  // before trying to read .app-config files, we check for the APP_CONFIG environment variable
  const env = new EnvironmentSource(environmentVariableName);
  logger.verbose(`Trying to read ${environmentVariableName} for configuration`);

  try {
    let parsed = await env.read(environmentExtensions);

    if (defaultValues) {
      parsed = ParsedValue.merge(ParsedValue.literal(defaultValues), parsed);
    }

    verifyParsedValue(parsed);

    return { parsed, fullConfig: parsed.toJSON() };
  } catch (error) {
    // having no APP_CONFIG environment variable is normal, and should fall through to reading files
    if (!(error instanceof NotFoundError)) throw error;
  }

  logger.verbose(`Trying to read files for configuration`);

  const [mainConfig, secrets] = await Promise.all([
    new FlexibleFileSource(
      join(directory, fileNameBase),
      environmentOverride,
      environmentAliases,
    ).read(parsingExtensions),

    new FlexibleFileSource(
      join(directory, secretsFileNameBase),
      environmentOverride,
      environmentAliases,
    )
      .read(secretsFileExtensions)
      .catch((error) => {
        // NOTE: secrets are optional, so not finding them is normal
        if (error instanceof NotFoundError) {
          logger.verbose('Did not find secrets file');
          return undefined;
        }

        throw error;
      }),
  ]);

  let parsed = secrets ? ParsedValue.merge(mainConfig, secrets) : mainConfig;

  if (defaultValues) {
    parsed = ParsedValue.merge(ParsedValue.literal(defaultValues), parsed);
  }

  // the APP_CONFIG_EXTEND and APP_CONFIG_CI can "extend" the config (override it), so it's done last
  if (extensionEnvironmentVariableNames.length > 0) {
    logger.verbose(
      `Checking [${extensionEnvironmentVariableNames.join(', ')}] for configuration extension`,
    );

    const extension = new FallbackSource(
      extensionEnvironmentVariableNames.map((varName) => new EnvironmentSource(varName)),
    );

    try {
      const parsedExtension = await extension.read(environmentExtensions);

      logger.verbose(
        `Found configuration extension in $${
          parsedExtension.assertSource(EnvironmentSource).variableName
        }`,
      );

      parsed = ParsedValue.merge(parsed, parsedExtension);
    } catch (error) {
      // having no APP_CONFIG_CI environment variable is normal, and should fall through to reading files
      if (!(error instanceof NotFoundError)) throw error;
    }
  }

  const filePaths = new Set<string>();

  for (const source of mainConfig.allSources()) {
    if (source instanceof FileSource) {
      filePaths.add(source.filePath);
    }
  }

  if (secrets) {
    for (const source of secrets.allSources()) {
      if (source instanceof FileSource) {
        filePaths.add(source.filePath);
      }
    }
  }

  verifyParsedValue(parsed);

  return {
    parsed,
    parsedSecrets: secrets,
    parsedNonSecrets: mainConfig.cloneWhere((v) => !v.meta.fromSecrets),
    fullConfig: parsed.toJSON(),
    filePaths: Array.from(filePaths),
  };
}

export async function loadValidatedConfig(
  options?: Options,
  schemaOptions?: SchemaOptions,
): Promise<Configuration> {
  const [{ validate }, { fullConfig, parsed, ...rest }] = await Promise.all([
    loadSchema({
      directory: options?.schemaDirectory ?? options?.directory,
      fileNameBase: options?.fileNameBase ? `${options.fileNameBase}.schema` : undefined,
      environmentOverride: options?.environmentOverride,
      environmentAliases: options?.environmentAliases,
      ...schemaOptions,
    }),
    loadConfig(options),
  ]);

  if (!isObject(fullConfig)) {
    throw new WasNotObject('Configuration was not an object');
  }

  logger.verbose('Config was loaded, validating now');
  validate(fullConfig, parsed);

  return { fullConfig, parsed, ...rest };
}

function verifyParsedValue(parsed: ParsedValue) {
  parsed.visitAll((value) => {
    for (const [key, item] of Object.entries(value.asObject() ?? {})) {
      if (key.startsWith('$') && !item.meta.fromEscapedDirective) {
        throw new ReservedKeyError(
          `Saw a '${key}' key in an object, which is a reserved key name. Please escape the '$' like '$${key}' if you intended to make this a literal object property.`,
        );
      }
    }
  });
}
