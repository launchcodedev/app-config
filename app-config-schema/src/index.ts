import { join, relative, resolve } from 'path';
import Ajv, { ValidateFunction, _ as ajvTemplate } from 'ajv';
import standalone from 'ajv/dist/standalone';
import addFormats from 'ajv-formats';
import RefParser, { JSONSchema, bundle } from 'json-schema-ref-parser';
import { isObject, isWindows, JsonObject } from '@app-config/utils';
import {
  parseRawString,
  filePathAssumedType,
  ParsedValue,
  ParsingExtension,
  WasNotObject,
  ValidationError,
  NotFoundError,
} from '@app-config/core';
import { logger } from '@app-config/logging';
import {
  asEnvOptions,
  EnvironmentAliases,
  EnvironmentSource,
  FileSource,
  FlexibleFileSource,
} from '@app-config/node';

export { JSONSchema };

export interface SchemaLoadingOptions {
  directory?: string;
  fileNameBase?: string;
  environmentVariableName?: string;
  environmentOverride?: string;
  environmentAliases?: EnvironmentAliases;
  environmentSourceNames?: string[] | string;
  parsingExtensions?: ParsingExtension[];
}

export type Validate = (fullConfig: JsonObject, parsed?: ParsedValue) => void;

export interface Schema {
  schema: JSONSchema;
  validate: Validate;
  validationFunctionCode(): string;
  validationFunctionCode(esm: true): [string, string];
  validationFunctionModule(): string;
  validationFunctionModule(esm: true): [string, string];
  validationFunction: ValidateFunction;
}

export async function loadSchema({
  directory = '.',
  fileNameBase = '.app-config.schema',
  environmentVariableName = 'APP_CONFIG_SCHEMA',
  environmentOverride,
  environmentAliases,
  environmentSourceNames,
  parsingExtensions = [],
}: SchemaLoadingOptions = {}): Promise<Schema> {
  const env = new EnvironmentSource(environmentVariableName);
  logger.verbose(`Trying to read ${environmentVariableName} for schema`);

  let parsed: ParsedValue | undefined;

  parsed = await env.read(parsingExtensions).catch((error) => {
    // having no APP_CONFIG_SCHEMA environment variable is normal, and should fall through to reading files
    if (NotFoundError.isNotFoundError(error)) {
      return undefined;
    }

    return Promise.reject(error);
  });

  if (!parsed) {
    logger.verbose(`Searching for ${fileNameBase} file`);

    const environmentOptions = asEnvOptions(
      environmentOverride,
      environmentAliases,
      environmentSourceNames,
    );

    const source = new FlexibleFileSource(
      join(directory, fileNameBase),
      undefined,
      environmentOptions,
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

  const ajv = new Ajv({
    strict: true,
    strictTypes: true,
    allErrors: true,
    code: {
      es5: true,
      lines: true,
      source: true,
      formats: ajvTemplate`require("ajv-formats/dist/formats.js").fullFormats`,
    },
  });

  addFormats(ajv);

  ajv.addKeyword({
    keyword: 'secret',
    schemaType: 'boolean',
    errors: false,
    error: {
      message: 'should not be present in non-secret files (and not encrypted)',
    },
    validate(value: boolean, _data, _parentSchema, ctx): boolean {
      const { instancePath } = ctx ?? {};

      if (!instancePath || !value) return true;

      const [, ...key] = instancePath.split('/');

      // check that any properties marked as secret were from secrets file
      const found = currentlyParsing?.property(key);

      if (found) {
        const arr = found.asArray();

        if (arr) {
          return arr.every((v) => v.meta.fromSecrets);
        }

        if (!found.meta.fromSecrets) {
          // arrays that are "secret" don't need to be secret themselves, just the items in that array do
          return false;
        }
      }

      return true;
    },
  });

  const validate = ajv.compile(normalized);

  let currentlyParsing: ParsedValue | undefined;

  const validationFunctionCode = ((esm) => {
    let code = standalone(ajv, validate);

    // resolve imports to absolute paths relative to _this_ package
    // this allows users of the webpack project not to have ajv as a dependency

    const resolvedAjvPath = join(require.resolve('ajv/package.json'), '..');
    const resolvedAjvFormatsPath = join(require.resolve('ajv-formats/package.json'), '..');

    code = code.replace(
      /require\("ajv\/(.+)"\)/g,
      (_, match) => `require("${join(resolvedAjvPath, match).replace(/\\/g, '\\\\\\\\')}")`,
    );

    code = code.replace(
      /require\("ajv-formats\/(.+)"\)/g,
      (_, match) => `require("${join(resolvedAjvFormatsPath, match).replace(/\\/g, '\\\\\\\\')}")`,
    );

    if (esm) {
      return requiresAsImports(code);
    }

    return code;
  }) as Schema['validationFunctionCode'];

  const validationFunctionModule = ((esm) => {
    let code: string;
    let imports: string = '';

    if (esm) {
      [imports, code] = schema.validationFunctionCode(true);
    } else {
      code = schema.validationFunctionCode();
    }

    return `${imports}
      const validateConfigModule = {};

      (function(module){${code}})(validateConfigModule);

      return validateConfigModule.exports;
    `;
  }) as Schema['validationFunctionModule'];

  const schema: Schema = {
    schema: normalized as JsonObject,
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
    validationFunctionCode,
    validationFunctionModule,
    get validationFunction() {
      const fnCode = schema.validationFunctionModule();

      // eslint-disable-next-line
      return new Function('require', fnCode)(require) as ValidateFunction;
    },
  };

  return schema;
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

// roughly inspired by https://github.com/jameswomack/replace-require-with-import/blob/master/index.js

// const createStore = require('redux')
const r1 =
  /^(let|var|const) +([a-zA-Z_$][a-zA-Z0-9_$]*) += +(require)\((('|")[a-zA-Z0-9-_./]+('|"))\)/gm;
// const createStore = require('redux').createStore
const r2 =
  /^(let|var|const) +([a-zA-Z_$][a-zA-Z0-9_$]*) += +(require)\((('|")[a-zA-Z0-9-_./]+('|"))\)\.([a-zA-Z][a-zA-Z0-9]+)/gm;
// const { createStore } = require('redux')
const r3 =
  /^(let|var|const) +(\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\}) += +(require)\((('|")[a-zA-Z0-9-_./]+('|"))\)/gm;
// const uri = require('redux').formats.uri
const r4 =
  /^(let|var|const) +([a-zA-Z_$][a-zA-Z0-9_$]*) += +(require)\((('|")[a-zA-Z0-9-_./]+('|"))\)\.([a-zA-Z][a-zA-Z0-9]+)\.([a-zA-Z][a-zA-Z0-9]+)/gm;

function requiresAsImports(text: string) {
  const withImports = text
    .replace(r4, `import * as $7Exports from $4; const { $8 } = $7Exports.$7;`)
    .replace(r3, `import { $3 } from $5;`)
    .replace(r2, `import { $7 as $2 } from $4;`)
    .replace(r1, `import $2 from $4;`);

  const importReg = /import .+;/gm;
  const imports = importReg.exec(withImports);

  if (imports) {
    return [withImports.replace(importReg, ''), imports.join('\n')];
  }

  return [withImports, ''];
}
