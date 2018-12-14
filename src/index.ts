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

// Create empty 'Config' interface that can be augmented per project
export interface Config {}
export default loaded.config as Config;

export {
  loadConfig,
  loadConfigSync,
  validate,
  loadSchema,
  loadSchemaSync,
  generateTypeFiles,
};
