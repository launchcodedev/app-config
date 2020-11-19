import { basename, extname, join } from 'path';
import { outputFile } from 'fs-extra';
import {
  quicktype,
  RendererOptions,
  JSONSchema,
  JSONSchemaInput,
  JSONSchemaStore,
  JSONSchemaSourceData,
  InputData,
} from 'quicktype-core';
import { JsonObject } from './common';
import { loadMetaConfig, Options as MetaOptions } from './meta';
import { loadSchema, Options as SchemaOptions } from './schema';
import { logger } from './logging';

export interface Options {
  directory?: string;
  schemaOptions?: SchemaOptions;
  metaOptions?: MetaOptions;
}

export interface GenerateFile {
  file: string;

  // Quicktype options
  name?: string;
  type?: string;
  augmentModule?: boolean;
  leadingComments?: string[];
  rendererOptions?: RendererOptions;
}

export async function generateTypeFiles({ directory, schemaOptions, metaOptions }: Options = {}) {
  const { value: schema, schemaRefs } = await loadSchema({ directory, ...schemaOptions });
  const {
    value: { generate = [] },
  } = await loadMetaConfig({ directory, ...metaOptions });

  const metaDirectory = metaOptions?.directory ?? directory ?? '.';

  // default to PascalCase with non-word chars removed
  const normalizeName = (file: string) =>
    basename(file, extname(file))
      .split(/[^\w]/)
      .map((s) => `${s.charAt(0).toUpperCase()}${s.slice(1)}`)
      .join('');

  await Promise.all(
    generate.map(
      async ({
        file,
        type = extname(file).slice(1),
        name = normalizeName(basename(file).split('.')[0]),
        augmentModule = true,
        leadingComments,
        rendererOptions = {},
      }) => {
        logger.info(`Generating ${file} as ${type}`);
        const lines = await generateQuicktype(
          schema,
          type,
          name,
          augmentModule,
          leadingComments,
          rendererOptions,
          schemaRefs,
        );

        await outputFile(join(metaDirectory, file), `${lines.join('\n')}${'\n'}`);
      },
    ),
  );

  return generate;
}

export async function generateQuicktype(
  schema: JsonObject,
  type: string,
  name: string,
  augmentModule: boolean = true,
  leadingComments: string[] = [
    'AUTO GENERATED CODE',
    "Run app-config with 'generate' command to regenerate this file",
  ],
  rendererOptions: RendererOptions = {},
  schemaRefs: JsonObject = {},
): Promise<string[]> {
  const src: JSONSchemaSourceData = {
    name,
    schema: JSON.stringify(schema),
  };

  class FetchingJSONSchemaStore extends JSONSchemaStore {
    async fetch(address: string): Promise<JSONSchema | undefined> {
      return schemaRefs[address] as JSONSchema;
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
    leadingComments,
    rendererOptions: {
      'just-types': 'true',
      'runtime-typecheck': 'false',
      ...rendererOptions,
    },
  });

  lines.splice(leadingComments.length, 0, '', "import '@lcdev/app-config';");

  // some configs are empty, so just mark them as an empty object
  if (!lines.some((line) => line.startsWith('export'))) {
    lines.push(`export interface ${name} {}\n`);
  }

  if (type === 'ts' && augmentModule !== false) {
    lines.push(
      ...[
        '// augment the default export from app-config',
        "declare module '@lcdev/app-config' {",
        `  export interface ExportedConfig extends ${name} {}`,
        '}',
      ],
    );
  }

  if (type === 'ts') {
    return (
      lines
        // this is a fix for quicktype, which adds an Object postfix, sometimes
        .map((line) => line.replace(`interface ${name}Object`, `interface ${name}`))
        .map((line) => line.replace(`: Date`, `: string`))
        .map((line) => line.replace(/: +(\w)/, ': $1'))
    );
  }

  return lines;
}
