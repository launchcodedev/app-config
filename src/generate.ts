import { join, basename, extname } from 'path';
import { outputFile } from 'fs-extra';
import { loadConfig, ConfigObject } from './config';
import { loadSchema, SchemaRefs } from './schema';
import { loadMeta, resetMetaProps } from './meta';
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
  name?: string;
  augmentModule?: boolean;
  leadingComments?: string[];
  rendererOptions?: { [key: string]: string };
}

export const generateTypeFiles = async (cwd = process.cwd()) => {
  resetMetaProps();

  // trigger reload of config and schema files so that metaProps are up to date
  const [{ schema, schemaRefs }] = await Promise.all([
    loadSchema(cwd),
    loadConfig(cwd).catch((_) => {}),
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
  }) => {
    const lines = await generateQuicktype(
      schema, schemaRefs, file, type, name, augmentModule, leadingComments, rendererOptions,
    );

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
}
