import { loadValidatedSync } from './schema';

let config;

if (process.env.APP_CONFIG_DISABLE !== '1') {
  config = loadValidatedSync().config;
} else {
  config = undefined as any;
}

// the config type that is exported to consumers and can be augmented
export interface ExportedConfig {}
export default config as ExportedConfig;
export * from './exports';
