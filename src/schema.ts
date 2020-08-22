import Ajv from 'ajv';
import * as _ from 'lodash';
import { join, dirname, resolve } from 'path';
import { ConfigObject, ConfigSubObject, ConfigSource, LoadedConfig, loadConfigRaw } from './config';
import { findParseableFile, parseFile, EncryptedValue } from './file-loader';

const schemaFileNames = ['.app-config.schema', 'app-config.schema'];

export enum InvalidConfig {
  InvalidSchema,
  SecretInNonSecrets,
  SchemaValidation,
}

export type SchemaRefs = ConfigObject;
export type Schema = {
  schema: ConfigObject;
  schemaRefs?: SchemaRefs;
};

export const loadSchema = async (
  cwd = process.cwd(),
  { envOverride }: { envOverride?: string } = {},
): Promise<Schema> => {
  const found = await findParseableFile(
    schemaFileNames.map(f => join(cwd, f)),
    undefined,
    envOverride,
  );

  if (!found) {
    throw new Error('Could not find app config schema.');
  }

  const schema = found[2];
  const schemaRefs = await extractExternalSchemas(schema, cwd);

  return { schema, schemaRefs };
};

export const validate = (
  input: Schema & LoadedConfig,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  cwd = process.cwd(),
): [InvalidConfig, Error] | false => {
  const { source, config, nonSecrets, schema, schemaRefs = {} } = input;

  const ajv = new Ajv({
    allErrors: true,
  });

  Object.entries(schemaRefs).forEach(([id, schema]) => ajv.addSchema(schema as object, id));

  // array of property paths that should only be present in secrets file
  const schemaSecrets: string[] = [];

  ajv.addKeyword('secret', {
    validate(schema: any, data: any, parentSchema?: object, dataPath?: string) {
      if (!dataPath) {
        return false;
      }

      const [_, ...key] = dataPath.split('.');
      schemaSecrets.push(key.join('.'));

      return schema === true;
    },
  });

  if (typeof schema !== 'object') {
    return [InvalidConfig.InvalidSchema, new Error('schema was not an object')];
  }

  if (!schema.$schema) {
    // default to draft 07
    schema.$schema = 'http://json-schema.org/draft-07/schema#';
  }

  // we have to convert our config into a POJO - we could have have EncryptedValue instances inside before
  Object.assign(config, JSON.parse(JSON.stringify(config)));

  const validate = ajv.compile(schema);
  const valid = validate(config);

  if (!valid) {
    const err = new Error(
      `Config is invalid: ${ajv.errorsText(validate.errors, { dataVar: 'config' })}`,
    );

    err.stack = undefined;

    return [InvalidConfig.SchemaValidation, err];
  }

  if (source === ConfigSource.File && nonSecrets) {
    // check that the nonSecrets does not contain any properties marked as secret
    const secretsInNonSecrets = schemaSecrets.filter(secret => {
      const found = _.get(nonSecrets, secret);

      if (found && !(found instanceof EncryptedValue)) {
        return secret;
      }

      return false;
    });

    if (secretsInNonSecrets.length > 0) {
      return [
        InvalidConfig.SecretInNonSecrets,
        new Error(
          `Found ${secretsInNonSecrets.map(s => `'.${s}'`).join(', ')} in non secrets file`,
        ),
      ];
    }
  }

  return false;
};

export const loadValidated = async (
  cwd = process.cwd(),
  { envOverride }: { envOverride?: string } = {},
) => {
  const loaded = await loadConfigRaw(cwd, { envOverride });
  const schema = await loadSchema(cwd, { envOverride });

  const validation = validate({ ...schema, ...loaded }, cwd);

  if (validation) {
    throw validation[1];
  }

  return loaded;
};

const extractExternalSchemas = async (
  schema: ConfigSubObject,
  cwd: string,
  schemas: SchemaRefs = {},
) => {
  if (schema && typeof schema === 'object') {
    for (const [key, val] of Object.entries(schema)) {
      if (key === '$ref' && typeof val === 'string') {
        // parse out "filename.json" from "filename.json#/Defs/ServerConfig"
        const [, , filepath, ref] = /^(\.\/)?([^#]*)(#?.*)/.exec(val)!;

        if (filepath) {
          // we resolve filepaths so that ajv resolves them correctly
          const resolvePath = resolve(join(cwd, filepath));
          const resolvePathEncoded = encodeURI(resolvePath);
          const [, , child] = await parseFile(resolvePath);

          await extractExternalSchemas(child, dirname(join(cwd, filepath)), schemas);

          if (!Array.isArray(schema)) {
            // replace the $ref inline with the resolvePath
            schema.$ref = `${resolvePathEncoded}${ref}`;
          }

          schemas[resolvePathEncoded] = child;
        }
      } else {
        await extractExternalSchemas(val, cwd, schemas);
      }
    }
  }

  return schemas;
};
