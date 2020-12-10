import { join, relative, resolve } from 'path';
import Ajv from 'ajv';
import RefParser, { JSONSchema, bundle } from 'json-schema-ref-parser';
import { JsonObject, isObject, isWindows } from './common';
import { ParsedValue, ParsingExtension } from './parsed-value';
import { defaultAliases, EnvironmentAliases } from './environment';
import {
  EnvironmentSource,
  FlexibleFileSource,
  FileSource,
  parseRawString,
  filePathAssumedType,
} from './config-source';
import { ValidationError, SecretsInNonSecrets, WasNotObject, NotFoundError } from './errors';
import { logger } from './logging';

export { JSONSchema };

export interface Options {
  directory?: string;
  fileNameBase?: string;
  environmentVariableName?: string;
  environmentOverride?: string;
  environmentAliases?: EnvironmentAliases;
  parsingExtensions?: ParsingExtension[];
}

export type Validate = (fullConfig: JsonObject, parsed?: ParsedValue) => void;

export interface Schema {
  value: JSONSchema;
  validate: Validate;
}

export async function loadSchema({
  directory = '.',
  fileNameBase = '.app-config.schema',
  environmentVariableName = 'APP_CONFIG_SCHEMA',
  environmentOverride,
  environmentAliases = defaultAliases,
  parsingExtensions = [],
}: Options = {}): Promise<Schema> {
  const env = new EnvironmentSource(environmentVariableName);
  logger.verbose(`Trying to read ${environmentVariableName} for schema`);

  let parsed: ParsedValue | undefined;

  parsed = await env.read(parsingExtensions).catch((error) => {
    // having no APP_CONFIG_SCHEMA environment variable is normal, and should fall through to reading files
    if (error instanceof NotFoundError) {
      return undefined;
    }

    return Promise.reject(error);
  });

  if (!parsed) {
    logger.verbose(`Searching for ${fileNameBase} file`);

    const source = new FlexibleFileSource(
      join(directory, fileNameBase),
      environmentOverride,
      environmentAliases,
    );

    parsed = await source.read(parsingExtensions);
  }

  const parsedObject = parsed.toJSON();

  if (!isObject(parsedObject)) throw new WasNotObject('JSON Schema was not an object');

  logger.verbose(
    `Loaded schema from ${
      parsed.getSource(FileSource)?.filePath ??
      parsed.getSource(EnvironmentSource)?.variableName ??
      'unknown source'
    }`,
  );

  // default to draft 07
  if (!parsedObject.$schema) {
    parsedObject.$schema = 'http://json-schema.org/draft-07/schema#';
  }

  const normalized = await normalizeSchema(parsedObject, directory);

  const ajv = new Ajv({ allErrors: true });

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

  const validate = ajv.compile(normalized);

  return {
    value: normalized as JsonObject,
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

async function normalizeSchema(schema: JsonObject, directory: string): Promise<JSONSchema> {
  // NOTE: http is enabled by default
  const resolveOptions: RefParser.Options['resolve'] = {
    file: {
      async read(file) {
        // resolves file:// urls, windows compat
        const path = toFileSystemPath(file.url);

        // we get passed in filepaths that are relative to CWD, but we want to ignore that
        const relativePath = relative(process.cwd(), path);
        // instead, we want to resolve the path relative to the provided directory
        const absolutePath = resolve(directory, relativePath);

        const [contents] = await new FileSource(absolutePath).readContents();

        return contents;
      },
    },
  };

  const options: RefParser.Options = {
    resolve: resolveOptions,
    parse: {
      json: false,
      yaml: false,
      text: false,
      any: {
        order: 1,
        canParse: ['.yml', '.yaml', '.json', '.json5', '.toml'],
        async parse(file) {
          const text = file.data.toString('utf8');

          const fileType = filePathAssumedType(file.url);
          const parsed = await parseRawString(text, fileType);

          if (!isObject(parsed)) {
            throw new WasNotObject(`JSON Schema was not an object (${file.url})`);
          }

          return parsed;
        },
      },
    },
  };

  const normalized = await bundle(schema, options);

  return normalized;
}

// ALL BELOW IS FROM https://github.com/APIDevTools/json-schema-ref-parser/blob/d3bc1985a9a1d301a5eddc7a4bbfaca542887d8c/lib/util/url.js
const forwardSlashPattern = /\//g;
const urlDecodePatterns = [/%23/g, '#', /%24/g, '$', /%26/g, '&', /%2C/g, ',', /%40/g, '@'];

function toFileSystemPath(path: string) {
  let retPath = decodeURI(path);

  for (let i = 0; i < urlDecodePatterns.length; i += 2) {
    retPath = retPath.replace(urlDecodePatterns[i], urlDecodePatterns[i + 1] as string);
  }

  let isFileUrl = retPath.substr(0, 7).toLowerCase() === 'file://';

  if (isFileUrl) {
    retPath = retPath[7] === '/' ? retPath.substr(8) : retPath.substr(7);

    if (isWindows && retPath[1] === '/') {
      retPath = `${retPath[0]}:${retPath.substr(1)}`;
    }

    isFileUrl = false;
    retPath = isWindows ? retPath : `/${retPath}`;
  }

  if (isWindows && !isFileUrl) {
    retPath = retPath.replace(forwardSlashPattern, '\\');

    if (retPath.substr(1, 2) === ':\\') {
      retPath = retPath[0].toUpperCase() + retPath.substr(1);
    }
  }

  return retPath;
}
