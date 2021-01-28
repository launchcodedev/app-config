import { inspect } from 'util';
import type { ValidateFunction } from 'ajv';
import { loadValidatedConfig, Options } from './config';
import { Options as SchemaOptions } from './schema';
import { AppConfigError, AccessingAppConfig } from './errors';
import { logger } from './logging';

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
  options?: Options,
  schemaOptions?: SchemaOptions,
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
  loadValidatedConfig,
  loadConfig as loadUnvalidatedConfig,
  Options as ConfigLoadingOptions,
} from './config';
export { loadSchema, Options as SchemaLoadingOptions } from './schema';
export { loadMetaConfig } from './meta';
export { setLogLevel, LogLevel } from './logging';
export { currentEnvironment, defaultAliases } from './environment';
export { Json } from './common';
export {
  ParsedValue,
  ParsedValueMetadata,
  ParsingExtension,
  ParsingExtensionTransform,
} from './parsed-value';
export {
  defaultExtensions,
  defaultEnvExtensions,
  environmentVariableSubstitution,
  encryptedDirective,
  envDirective,
  extendsDirective,
  extendsSelfDirective,
  overrideDirective,
} from './extensions';
export {
  ConfigSource,
  FileSource,
  FlexibleFileSource,
  EnvironmentSource,
  LiteralSource,
  CombinedSource,
  FallbackSource,
  FileType,
  stringify,
  filePathAssumedType,
  parseRawString,
} from './config-source';

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
