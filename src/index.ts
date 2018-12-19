import { loadValidatedSync } from './schema';

const { config } = loadValidatedSync();

// the config type that is exported to consumers and can be augmented
export interface ExportedConfig {}
export default config as ExportedConfig;
export * from './exports';
