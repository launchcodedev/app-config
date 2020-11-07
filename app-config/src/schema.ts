import { resolve, join, dirname } from 'path';
import Ajv from 'ajv';
import { JsonObject, isObject } from './common';
import { ParsedValue } from './parsed-value';
import { FlexibleFileSource, FileSource } from './config-source';

export type Validate = (fullConfig: JsonObject, nonSecrets?: ParsedValue) => void;

export interface Schema {
  value: JsonObject;
  validate: Validate;
}

export async function loadSchema(
  fileName = '.app-config.schema',
  environmentOverride?: string,
): Promise<Schema> {
  const source = new FlexibleFileSource(fileName, environmentOverride);
  const parsed = await source.readToJSON();

  if (!isObject(parsed)) throw new Error('JSON Schema was not an object');

  const ajv = new Ajv({ allErrors: true });

  const schemaRefs = await extractExternalSchemas(parsed);
  Object.entries(schemaRefs).forEach(([id, schema]) => ajv.addSchema(schema as object, id));

  // array of property paths that should only be present in secrets file
  const schemaSecrets: string[][] = [];

  ajv.addKeyword('secret', {
    validate(schema: any, data: any, parentSchema?: object, dataPath?: string) {
      if (!dataPath) return false;

      const [_, ...key] = dataPath.split('.');
      schemaSecrets.push(key);

      return schema === true;
    },
  });

  // default to draft 07
  if (!parsed.$schema) {
    parsed.$schema = 'http://json-schema.org/draft-07/schema#';
  }

  const validate = ajv.compile(parsed);

  return {
    value: parsed,
    validate(fullConfig, nonSecrets) {
      const valid = validate(fullConfig);

      if (!valid) {
        const err = new Error(
          `Config is invalid: ${ajv.errorsText(validate.errors, { dataVar: 'config' })}`,
        );

        err.stack = undefined;

        throw err;
      }

      if (nonSecrets) {
        // check that the nonSecrets does not contain any properties marked as secret
        const secretsInNonSecrets = schemaSecrets.filter((path) => {
          const found = nonSecrets.property(path);

          if (found) return !found.meta.parsedFromEncryptedValue;

          return false;
        });

        if (secretsInNonSecrets.length > 0) {
          throw new Error(
            `Found ${secretsInNonSecrets
              .map((s) => `'.${s.join('.')}'`)
              .join(', ')} in non secrets file`,
          );
        }
      }
    },
  };
}

async function extractExternalSchemas(
  schema: JsonObject,
  schemas: JsonObject = {},
  cwd: string = process.cwd(),
): Promise<JsonObject> {
  if (schema && typeof schema === 'object') {
    for (const [key, val] of Object.entries(schema)) {
      if (key === '$ref' && typeof val === 'string') {
        // parse out "filename.json" from "filename.json#/Defs/ServerConfig"
        const [, , filepath, ref] = /^(\.\/)?([^#]*)(#?.*)/.exec(val)!;

        if (filepath) {
          // we resolve filepaths so that ajv resolves them correctly
          const resolvePath = resolve(join(cwd, filepath));
          const resolvePathEncoded = encodeURI(resolvePath);
          const child = (await new FileSource(resolvePath).readToJSON()) as JsonObject;

          await extractExternalSchemas(child, schemas, dirname(join(cwd, filepath)));

          if (!Array.isArray(schema)) {
            // replace the $ref inline with the resolvePath
            schema.$ref = `${resolvePathEncoded}${ref}`;
          }

          schemas[resolvePathEncoded] = child;
        }
      } else if (isObject(val)) {
        await extractExternalSchemas(val, schemas, cwd);
      }
    }
  }

  return schemas;
}
