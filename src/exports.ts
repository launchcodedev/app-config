export { loadConfig, loadConfigSync } from './config';
export { loadSchema, loadSchemaSync, validate, loadValidated, loadValidatedSync } from './schema';
export { loadMeta } from './meta';
export { generateTypeFiles } from './generate';

// the config type that is exported to consumers and can be augmented
export interface ExportedConfig {}
