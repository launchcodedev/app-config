import { loadValidatedSync } from './schema';

// the config type that is exported to consumers and can be augmented
import { ExportedConfig } from './exports';

let config;

if (process.env.APP_CONFIG_DISABLE !== '1') {
  config = loadValidatedSync().config;
} else {
  config = undefined as any;
}

export default config as ExportedConfig;
export * from './exports';
