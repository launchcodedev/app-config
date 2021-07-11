import { inspect } from 'util';
import type { ValidateFunction } from 'ajv';
import { AppConfigError } from '@app-config/core';
import { logger } from '@app-config/logging';
import { loadValidatedConfig, ConfigLoadingOptions } from '@app-config/config';
import { SchemaLoadingOptions } from '@app-config/schema';

// the config type that is exported to consumers and can be augmented
export interface ExportedConfig {}

/** Tried to read app-config value before it was loaded */
export class AccessingAppConfig extends AppConfigError {}

// the export of this module is a proxy in front of this value
let loadedConfig: ExportedConfig | undefined;
let isMocked = false;

const assertLoaded = () => {
  if (!loadedConfig) {
    throw new AccessingAppConfig('Tried to read app-config value before calling loadConfig!');
  }

  return loadedConfig;
};

/**
 * Reads and validates app-config, using the default loading strategy.
 * Same as `loadValidatedConfig` but stores loaded config in the `config` export.
 */
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

/**
 * Singleton for loaded configuration, when `loadConfig` has completed successfully.
 *
 * Reading properties on this object before `loadConfig` completes will throw errors.
 */
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
 * ONLY available when using @app-config/webpack. Validates configuration using AJV.
 */
export const validateConfig: ValidateFunction<ExportedConfig> = null as any; // eslint-disable-line

export { setLogLevel, LogLevel } from '@app-config/logging';

export {
  loadValidatedConfig,
  loadUnvalidatedConfig,
  ConfigLoadingOptions,
} from '@app-config/config';

export { loadSchema, SchemaLoadingOptions } from '@app-config/schema';

export { loadMetaConfig } from '@app-config/meta';

export {
  currentEnvironment,
  defaultAliases,
  FileSource,
  FlexibleFileSource,
  EnvironmentSource,
} from '@app-config/node';

export {
  defaultExtensions,
  defaultEnvExtensions,
  defaultMetaExtensions,
} from '@app-config/extensions';

/** @hidden Please don't rely on this. */
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
