import { loadConfig, loadConfigSync } from './config';
import { loadSchema, loadSchemaSync, validate } from './schema';

const loaded = loadConfigSync();

const validation = validate({
  schema: loadSchemaSync(),
  ...loaded,
});

if (validation) {
  throw validation[1];
}

export default loaded.config;
export { loadConfig, loadConfigSync } from './config';
export { loadSchema, loadSchemaSync, validate } from './schema';
