import { loadValidatedSync } from './schema';

let config;

if (process.env.APP_CONFIG_DISABLE !== '1') {
  const configCwd = process.env.APP_CONFIG_CWD ?? process.cwd();
  const schemaCwd = process.env.APP_CONFIG_SCHEMA_CWD ?? configCwd;

  config = loadValidatedSync(configCwd, schemaCwd).config;
} else {
  config = undefined as any;
}

// the config type that is exported to consumers and can be augmented
export interface ExportedConfig {}
export default config as ExportedConfig;
export * from './exports';
