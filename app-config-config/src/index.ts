import { join } from 'path';
import { Json, isObject } from '@app-config/utils';
import {
  ParsedValue,
  ParsingExtension,
  FallbackSource,
  NotFoundError,
  WasNotObject,
  ReservedKeyError,
} from '@app-config/core';
import { logger } from '@app-config/logging';
import {
  FileSource,
  FlexibleFileSource,
  defaultAliases,
  EnvironmentAliases,
  EnvironmentSource,
  asEnvOptions,
} from '@app-config/node';
import {
  defaultExtensions,
  defaultEnvExtensions,
  markAllValuesAsSecret,
} from '@app-config/extensions';
import { loadSchema, JSONSchema, SchemaLoadingOptions, Schema } from '@app-config/schema';
import { loadMetaConfig, loadExtraParsingExtensions } from '@app-config/meta';

export interface ConfigLoadingOptions {
  directory?: string;
  fileNameBase?: string;
  secretsFileNameBase?: string;
  environmentVariableName?: string;
  extensionEnvironmentVariableNames?: string[];
  environmentOverride?: string;
  environmentAliases?: EnvironmentAliases;
  environmentSourceNames?: string[] | string;
  parsingExtensions?: ParsingExtension[];
  secretsFileExtensions?: ParsingExtension[];
  environmentExtensions?: ParsingExtension[];
  defaultValues?: Json;
}

export interface LoadedConfiguration {
  /** full configuration plain JSON, with secrets and nonSecrets */
  fullConfig: Json;
  /** parsed configuration value, with metadata (like ConfigSource) still attached */
  parsed: ParsedValue;
  parsedSecrets?: ParsedValue;
  parsedNonSecrets?: ParsedValue;
  /** non-exhaustive list of files that were read (useful for reloading in plugins) */
  filePaths?: string[];
  /** if loadValidatedConfig, this is the normalized JSON schema that was used for validation */
  schema?: JSONSchema;
  /** if loadValidatedConfig, this is the raw AJV validation function */
  validationFunctionCode?: Schema['validationFunctionCode'];
}

export async function loadUnvalidatedConfig({
  directory = '.',
  fileNameBase = '.app-config',
  secretsFileNameBase = `${fileNameBase}.secrets`,
  environmentVariableName = 'APP_CONFIG',
  extensionEnvironmentVariableNames = ['APP_CONFIG_EXTEND', 'APP_CONFIG_CI'],
  environmentOverride,
  environmentAliases: environmentAliasesArg,
  environmentSourceNames: environmentSourceNamesArg,
  parsingExtensions: parsingExtensionsArg,
  secretsFileExtensions: secretsFileExtensionsArg,
  environmentExtensions = defaultEnvExtensions(),
  defaultValues,
}: ConfigLoadingOptions = {}): Promise<LoadedConfiguration> {
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
    if (!NotFoundError.isNotFoundError(error)) throw error;
  }

  const meta = await loadMetaConfig({ directory });

  const environmentSourceNames = environmentSourceNamesArg ?? meta.value.environmentSourceNames;
  const environmentAliases =
    environmentAliasesArg ?? meta.value.environmentAliases ?? defaultAliases;

  const environmentOptions = asEnvOptions(
    environmentOverride,
    environmentAliases,
    environmentSourceNames,
  );

  const parsingExtensions = parsingExtensionsArg ?? defaultExtensions();

  const secretsFileExtensions =
    secretsFileExtensionsArg ?? parsingExtensions.concat(markAllValuesAsSecret());

  logger.verbose(`Loading extra parsing extensions`);
  const extraParsingExtensions = await loadExtraParsingExtensions(meta);

  logger.verbose(`${extraParsingExtensions.length} user-defined parsing extensions found`);

  parsingExtensions.splice(0, 0, ...extraParsingExtensions);
  secretsFileExtensions.splice(0, 0, ...extraParsingExtensions);

  logger.verbose(`Trying to read files for configuration`);

  const [mainConfig, secrets] = await Promise.all([
    new FlexibleFileSource(join(directory, fileNameBase), undefined, environmentOptions).read(
      parsingExtensions,
    ),

    new FlexibleFileSource(join(directory, secretsFileNameBase), undefined, environmentOptions)
      .read(secretsFileExtensions)
      .catch((error) => {
        // NOTE: secrets are optional, so not finding them is normal
        if (NotFoundError.isNotFoundError(error, join(directory, secretsFileNameBase))) {
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
      if (!NotFoundError.isNotFoundError(error)) throw error;
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
  options?: ConfigLoadingOptions,
  schemaOptions?: SchemaLoadingOptions,
): Promise<LoadedConfiguration> {
  const [{ validate, validationFunctionCode, schema }, { fullConfig, parsed, ...rest }] =
    await Promise.all([
      loadSchema({
        directory: options?.directory,
        fileNameBase: options?.fileNameBase ? `${options.fileNameBase}.schema` : undefined,
        environmentVariableName: options?.environmentVariableName
          ? `${options.environmentVariableName}_SCHEMA`
          : undefined,
        environmentOverride: options?.environmentOverride,
        environmentAliases: options?.environmentAliases,
        environmentSourceNames: options?.environmentSourceNames,
        ...schemaOptions,
      }),
      loadUnvalidatedConfig(options),
    ]);

  if (!isObject(fullConfig)) {
    throw new WasNotObject('Configuration was not an object');
  }

  logger.verbose('Config was loaded, validating now');
  validate(fullConfig, parsed);

  return { fullConfig, parsed, schema, validationFunctionCode, ...rest };
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
