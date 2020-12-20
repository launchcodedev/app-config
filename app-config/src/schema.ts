import { join, relative, resolve } from 'path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import RefParser, { bundle } from 'json-schema-ref-parser';
import { JsonObject, isObject, isWindows } from './common';
import { ParsedValue, ParsingExtension } from './parsed-value';
import { defaultAliases, EnvironmentAliases } from './environment';
import {
  FlexibleFileSource,
  FileSource,
  parseRawString,
  filePathAssumedType,
} from './config-source';
import { ValidationError, WasNotObject } from './errors';

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

  const parsed = await source.read(parsingExtensions);
  const parsedObject = parsed.toJSON();

  if (!isObject(parsedObject)) throw new WasNotObject('JSON Schema was not an object');

  // default to draft 07
  if (!parsedObject.$schema) {
    parsedObject.$schema = 'http://json-schema.org/draft-07/schema#';
  }

  const normalized = await normalizeSchema(parsedObject, directory);

  const ajv = new Ajv({ strict: true, strictTypes: true, allErrors: true });

  addFormats(ajv);

  ajv.addKeyword({
    keyword: 'secret',
    schemaType: 'boolean',
    errors: false,
    error: {
      message: 'should not be present in non-secret files (and not encrypted)',
    },
    validate(value: boolean, _data, _parentSchema, ctx): boolean {
      const { dataPath } = ctx ?? {};

      if (!dataPath || !value) return true;

      const [, ...key] = dataPath.split('/');

      // check that any properties marked as secret were from secrets file
      const found = currentlyParsing?.property(key);

      if (found) {
        const arr = found.asArray();

        if (arr) {
          if (!arr.every((v) => v.meta.fromSecrets)) {
            return false;
          }
        }

        if (!found.meta.fromSecrets) {
          return false;
        }
      }

      return true;
    },
  });

  const validate = ajv.compile(normalized);

  let currentlyParsing: ParsedValue | undefined;

  return {
    value: normalized as JsonObject,
    validate(fullConfig, parsedConfig) {
      currentlyParsing = parsedConfig;
      const valid = validate(fullConfig);
      currentlyParsing = undefined;

      if (!valid) {
        const err = new ValidationError(
          `Config is invalid: ${ajv.errorsText(validate.errors, { dataVar: 'config' })}`,
        );

        err.stack = undefined;

        throw err;
      }
    },
  };
}

async function normalizeSchema(
  schema: JsonObject,
  directory: string,
): Promise<RefParser.JSONSchema> {
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
