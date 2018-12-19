import { loadConfig, loadConfigSync } from './config';
import { loadSchema, loadSchemaSync, validate, loadValidated, loadValidatedSync } from './schema';
import { generateTypeFiles } from './meta';

const { config } = loadValidatedSync();

// the config type that is exported to consumers and can be augmented
export interface ExportedConfig {}
export default config as ExportedConfig;

export {
  loadConfig,
  loadConfigSync,
  validate,
  loadValidated,
  loadValidatedSync,
  loadSchema,
  loadSchemaSync,
  generateTypeFiles,
};
