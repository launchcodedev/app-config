import { join, basename, extname } from 'path';
import { outputFile } from 'fs-extra';
import { stringify, extToFileType } from './file-loader';
import { loadConfig, ConfigObject } from './config';
import { loadSchema, SchemaRefs } from './schema';
import { loadMeta, resetMetaProps } from './meta';
import * as refParser from 'json-schema-ref-parser';
import {
  quicktype,
  RendererOptions,
  JSONSchema,
  JSONSchemaInput,
  JSONSchemaStore,
  JSONSchemaSourceData,
  InputData,
} from 'quicktype-core';

export interface GenerateFile {
  file: string;
  type?: string;

  // Quicktype options
  name?: string;
  augmentModule?: boolean;
  leadingComments?: string[];
  rendererOptions?: { [key: string]: string };

  // Config output options
  includeSecrets?: boolean;
  select?: string;
}

export const generateTypeFiles = async (cwd = process.cwd()) => {
  resetMetaProps();

  const [{ schema, schemaRefs }, { config, nonSecrets }] = await Promise.all([
    loadSchema(cwd),
    loadConfig(cwd),
  ]);

  const meta = await loadMeta(cwd);

  const { generate = [] } = meta;

  // default to PascalCase with non-word chars removed
  const normalizeName = (file: string) => basename(file, extname(file))
      .split(/[^\w]/)
      .map(s => `${s.charAt(0).toUpperCase()}${s.slice(1)}`)
      .join('');

  await Promise.all(generate.map(async ({
    file,
    type = extname(file).slice(1),
    name = normalizeName(file),
    augmentModule = true,
    leadingComments,
    rendererOptions = {},
    includeSecrets = false,
    select = '#',
  }) => {
    let lines;

    switch (type) {
      case 'json':
      case 'json5':
      case 'toml':
      case 'yml':
      case 'yaml': {
        const output = includeSecrets ? config : nonSecrets;
        const refs = await refParser.resolve(output);
        const selected = refs.get(select);

        lines = [stringify(selected as ConfigObject, extToFileType(type))];
        break;
      }
      default: {
        lines = await generateQuicktype(
          schema, schemaRefs, file, type, name, augmentModule, leadingComments, rendererOptions,
        );
        break;
      }
    }

    await outputFile(join(cwd, file), `${lines.join('\n')}${'\n'}`);
  }));

  return generate;
};

const generateQuicktype = async (
  schema: ConfigObject,
  schemaRefs: SchemaRefs | undefined,
  file: string,
  type: string,
  name: string,
  augmentModule: boolean,
  leadingComments: string[] | undefined,
  rendererOptions: RendererOptions,
) => {
  const src: JSONSchemaSourceData = {
    name,
    schema: JSON.stringify(schema),
  };

  class FetchingJSONSchemaStore extends JSONSchemaStore {
    async fetch(address: string): Promise<JSONSchema | undefined> {
      return (schemaRefs as any)[address];
    }
  }

  const inputData = new InputData();
  await inputData.addSource(
    'schema',
    src,
    () => new JSONSchemaInput(new FetchingJSONSchemaStore(), []),
  );

  const { lines } = await quicktype({
    inputData,
    lang: type,
    indentation: '  ',
    leadingComments: leadingComments || [
      'AUTO GENERATED CODE',
      'Run app-config with \'generate\' command to regenerate this file',
    ],
    rendererOptions: {
      'just-types': 'true',
      'runtime-typecheck': 'false',
      ...rendererOptions,
    },
  });

  if (type === 'ts' && augmentModule !== false) {
    lines.push(...[
      '// augment the default export from app-config',
      "declare module '@servall/app-config' {",
      `  export interface ExportedConfig extends ${name} {}`,
      '}',
    ]);
  }

  return lines;
};
