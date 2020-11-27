import { resolve, join, dirname } from 'path';
import Ajv from 'ajv';
import { Json, JsonObject, isObject } from './common';
import { ParsedValue, ParsingExtension } from './parsed-value';
import { defaultAliases, EnvironmentAliases } from './environment';
import { FlexibleFileSource, FileSource } from './config-source';
import { ValidationError, SecretsInNonSecrets, WasNotObject } from './errors';

export interface Options {
  directory?: string;
  fileNameBase?: string;
  environmentOverride?: string;
  environmentAliases?: EnvironmentAliases;
  parsingExtensions?: ParsingExtension[];
}

export type Validate = (fullConfig: JsonObject, parsed?: ParsedValue) => void;

export interface Schema {
  value: JsonObject;
  validate: Validate;

  /** @hidden */
  schemaRefs: JsonObject;
}

export async function loadSchema({
  directory = '.',
  fileNameBase = '.app-config.schema',
  environmentOverride,
  environmentAliases = defaultAliases,
  parsingExtensions = [],
}: Options = {}): Promise<Schema> {
  const source = new FlexibleFileSource(
    join(directory, fileNameBase),
    environmentOverride,
    environmentAliases,
  );

  const parsed = await source.readToJSON(parsingExtensions);

  if (!isObject(parsed)) throw new WasNotObject('JSON Schema was not an object');

  const ajv = new Ajv({ allErrors: true });

  const schemaRefs = await extractExternalSchemas(parsed, directory);

  Object.entries(schemaRefs).forEach(([$id, schema]) => {
    ajv.addSchema({ $id, ...schema });
  });

  // array of property paths that should only be present in secrets file
  const schemaSecrets: string[][] = [];

  ajv.addKeyword('secret', {
    validate(schema: any, _data: any, _parentSchema?: object, dataPath?: string) {
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
    schemaRefs,
    validate(fullConfig, parsedConfig) {
      const valid = validate(fullConfig);

      if (!valid) {
        const err = new ValidationError(
          `Config is invalid: ${ajv.errorsText(validate.errors, { dataVar: 'config' })}`,
        );

        err.stack = undefined;

        throw err;
      }

      if (parsedConfig) {
        // check that any properties marked as secret were from secrets file
        const secretsInNonSecrets = schemaSecrets.filter((path) => {
          const found = parsedConfig.property(path);

          if (found) {
            const arr = found.asArray();

            if (arr) {
              return !arr.every((value) => value.meta.fromSecrets);
            }

            return !found.meta.fromSecrets;
          }

          return false;
        });

        if (secretsInNonSecrets.length > 0) {
          throw new SecretsInNonSecrets(
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
  schema: Json,
  cwd: string,
  schemas: { [$id: string]: JsonObject } = {},
): Promise<{ [$id: string]: JsonObject }> {
  const resolveReference = async (
    resolvedPathEncoded: string,
    ref: string,
    referencedSchema: JsonObject,
    newCwd: string,
  ) => {
    // replace the $ref inline with the canonical path
    Object.assign(schema, { $ref: `${resolvedPathEncoded}${ref}` });

    // short-circuit, to prevent circular dependencies from creating infinite recursion
    if (schemas[resolvedPathEncoded]) {
      return schemas;
    }

    // tell the schema who they are, mostly for clarity
    referencedSchema.$id = resolvedPathEncoded;

    // add schema to schemaRefs object, so they can be added to Ajv
    Object.assign(schemas, { [resolvedPathEncoded]: referencedSchema });

    // recurse into referenced schema, to retrieve any references
    await extractExternalSchemas(referencedSchema, newCwd, schemas);
  };

  if (isObject(schema)) {
    if (schema.$ref && typeof schema.$ref === 'string') {
      // parse out "filename.json" from "filename.json#/Defs/ServerConfig"
      const [, , filepath, ref] = /^(\.\/)?([^#]*)(#?.*)/.exec(schema.$ref) ?? [];

      if (filepath) {
        // we resolve filepaths so that ajv resolves them correctly
        const resolvedPath = resolve(join(cwd, filepath));
        const resolvedPathEncoded = encodeURI(resolvedPath);
        const referencedSchema = await new FileSource(resolvedPath).readToJSON();

        if (isObject(referencedSchema)) {
          await resolveReference(resolvedPathEncoded, ref, referencedSchema, dirname(resolvedPath));
        }
      }
    }

    // for all other keys, we'll descend into subobjects
    for (const val of Object.values(schema)) {
      if (isObject(val)) {
        await extractExternalSchemas(val, cwd, schemas);
      } else if (Array.isArray(val)) {
        await Promise.all(val.map((v) => extractExternalSchemas(v, cwd, schemas)));
      }
    }
  }

  return schemas;
}
