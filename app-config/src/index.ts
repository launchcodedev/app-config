import { inspect } from 'util';
import type { ValidateFunction } from 'ajv';
import { AppConfigError, AccessingAppConfig, logger } from '@app-config/core';
import { loadValidatedConfig, ConfigLoadingOptions, SchemaLoadingOptions } from '@app-config/node';

// the config type that is exported to consumers and can be augmented
export interface ExportedConfig {}

// the export of this module is a proxy in front of this value
let loadedConfig: ExportedConfig | undefined;
let isMocked = false;

const assertLoaded = () => {
  if (!loadedConfig) {
    throw new AccessingAppConfig('Tried to read app-config value before calling loadConfig!');
  }

  return loadedConfig;
};

export async function loadConfig(
  options?: ConfigLoadingOptions,
  schemaOptions?: SchemaLoadingOptions,
): Promise<ExportedConfig> {
  if (loadedConfig) {
    logger.warn('Called loadConfig, even though config was already loaded elsewhere');

    if (isMocked) {
      throw new AppConfigError(`Called loadConfig after config was mocked with mockConfig!`);
    }
  }

  const { fullConfig } = await loadValidatedConfig(options, schemaOptions);

  loadedConfig = fullConfig as ExportedConfig;

  return config;
}

export const config: ExportedConfig = new Proxy(
  {
    APP_CONFIG_WAS_NOT_LOADED_YET_LOOK_AT_THE_DOCS: true,

    [inspect.custom]() {
      return inspect(assertLoaded());
    },
    toJSON() {
      return assertLoaded();
    },
  },
  {
    ownKeys() {
      return Reflect.ownKeys(assertLoaded());
    },
    has(_, key) {
      return key in assertLoaded();
    },
    get(_, prop): unknown {
      return Reflect.get(assertLoaded(), prop);
    },
    getOwnPropertyDescriptor(_, key) {
      return Object.getOwnPropertyDescriptor(assertLoaded(), key);
    },
    set() {
      throw new AppConfigError('Setting properties on app-config is not allowed');
    },
    defineProperty() {
      throw new AppConfigError('Setting properties on app-config is not allowed');
    },
    deleteProperty() {
      throw new AppConfigError('Deleting properties from app-config is not allowed');
    },
  },
);

export default config;

/**
 * Only available when using @lcdev/app-config-webpack-plugin. Validates configuration using AJV.
 */
export const validateConfig: ValidateFunction<ExportedConfig> = null as any; // eslint-disable-line

export {
  setLogLevel,
  LogLevel,
  Json,
  ParsedValue,
  ParsedValueMetadata,
  ParsingExtension,
  ParsingExtensionTransform,
  ConfigSource,
  LiteralSource,
  CombinedSource,
  FallbackSource,
  FileType,
  stringify,
  filePathAssumedType,
  parseRawString,
} from '@app-config/core';

export {
  loadValidatedConfig,
  loadUnvalidatedConfig,
  loadSchema,
  loadMetaConfig,
  currentEnvironment,
  defaultAliases,
  defaultExtensions,
  defaultEnvExtensions,
  environmentVariableSubstitution,
  encryptedDirective,
  envDirective,
  extendsDirective,
  extendsSelfDirective,
  overrideDirective,
  ConfigLoadingOptions,
  SchemaLoadingOptions,
  FileSource,
  FlexibleFileSource,
  EnvironmentSource,
} from '@app-config/node';

/** @hidden */
export function resetConfigInternal() {
  loadedConfig = undefined;
}

/**
 * Overrides the configuration internally, setting it to the provided override.
 */
export function mockConfig(override: ExportedConfig): () => void {
  loadedConfig = override;
  isMocked = true;

  return () => {
    loadedConfig = undefined;
    isMocked = false;
  };
}
