import { inspect } from 'util';
import { loadValidatedConfig, Options } from './config';
import { AppConfigError, AccessingAppConfig } from './errors';

// the config type that is exported to consumers and can be augmented
export interface ExportedConfig {}

// the export of this module is a proxy in front of this value
let loadedConfig: ExportedConfig | undefined;

const assertLoaded = () => {
  if (!loadedConfig) {
    throw new AccessingAppConfig('Tried to read app-config value before calling loadConfig!');
  }
};

export async function loadConfig(options?: Options): Promise<ExportedConfig> {
  const { fullConfig } = await loadValidatedConfig(options);

  loadedConfig = fullConfig as ExportedConfig;

  return loadedConfig;
}

export const config: ExportedConfig = new Proxy(
  {
    APP_CONFIG_WAS_NOT_LOADED_YET_LOOK_AT_THE_DOCS: true,

    [inspect.custom]() {
      assertLoaded();

      return inspect(loadedConfig);
    },
    toJSON() {
      assertLoaded();

      return loadedConfig!;
    },
  },
  {
    ownKeys() {
      assertLoaded();
      return Reflect.ownKeys(loadedConfig!);
    },
    has(_, key) {
      assertLoaded();
      return key in loadedConfig!;
    },
    get(_, prop): unknown {
      assertLoaded();
      return Reflect.get(loadedConfig!, prop);
    },
    getOwnPropertyDescriptor(_, key) {
      assertLoaded();
      return Object.getOwnPropertyDescriptor(loadedConfig!, key);
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
    isExtensible() {
      return false;
    },
  },
);

export default config;

export {
  loadValidatedConfig,
  loadConfig as loadUnvalidatedConfig,
  Options as ConfigLoadingOptions,
} from './config';
export { loadSchema, Options as SchemaLoadingOptions } from './schema';
export { loadMetaConfig } from './meta';
export { setLogLevel, LogLevel } from './logging';
export { currentEnvironment, defaultAliases } from './environment';
export { ParsedValue, ParsedValueMetadata } from './parsed-value';
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

export function resetConfigInternal() {
  loadedConfig = undefined;
}
