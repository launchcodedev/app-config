import { loadValidated } from './exports';

export * from './exports';

// the config type that is exported to consumers and can be augmented
export interface ExportedConfig {}

let realConfigValue: ExportedConfig;

const config: ExportedConfig = new Proxy(
  { APP_CONFIG_WAS_NOT_LOADED_YET_LOOK_AT_THE_DOCS: true },
  {
    get(target, ...args) {
      if (!realConfigValue) {
        throw new Error('Tried to read app-config value before calling loadConfig!!');
      }

      return Reflect.get(realConfigValue, ...args);
    },
  },
);

export async function loadConfig(): Promise<ExportedConfig> {
  ({ config: realConfigValue } = await loadValidated());

  return realConfigValue;
}

export default config;
