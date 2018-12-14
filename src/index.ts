import { loadConfig, loadConfigSync } from './config';
import { loadSchema, loadSchemaSync, validate } from './schema';
import { generateTypeFiles } from './meta';

const loaded = loadConfigSync();

const validation = validate({
  schema: loadSchemaSync(),
  ...loaded,
});

if (validation) {
  throw validation[1];
}

// the config type that is exported to consumers and can be augmented
export interface ExportedConfig {}
export default loaded.config as ExportedConfig;

export {
  loadConfig,
  loadConfigSync,
  validate,
  loadSchema,
  loadSchemaSync,
  generateTypeFiles,
};
