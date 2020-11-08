import { basename, extname } from 'path';
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
import { loadMetaConfigLazy } from './meta';
import { loadSchema } from './schema';
import { logger } from './logging';

export interface GenerateFile {
  file: string;

  // Quicktype options
  name?: string;
  type?: string;
  augmentModule?: boolean;
  leadingComments?: string[];
  rendererOptions?: { [key: string]: string };
}

export const generateTypeFiles = async () => {
  const { value: schema, schemaRefs } = await loadSchema();
  const {
    value: { generate = [] },
  } = await loadMetaConfigLazy();

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
          schemaRefs,
          file,
          type,
          name,
          augmentModule,
          leadingComments,
          rendererOptions,
        );

        await outputFile(file, `${lines.join('\n')}${'\n'}`);
      },
    ),
  );

  return generate;
};

async function generateQuicktype(
  schema: JsonObject,
  schemaRefs: JsonObject | undefined,
  file: string,
  type: string,
  name: string,
  augmentModule: boolean,
  leadingComments: string[] | undefined,
  rendererOptions: RendererOptions,
) {
  const src: JSONSchemaSourceData = {
    name,
    schema: JSON.stringify(schema),
  };

  class FetchingJSONSchemaStore extends JSONSchemaStore {
    async fetch(address: string): Promise<JSONSchema | undefined> {
      return (schemaRefs as any)[address] as JSONSchema;
    }
  }

  const inputData = new InputData();
  await inputData.addSource(
    'schema',
    src,
    () => new JSONSchemaInput(new FetchingJSONSchemaStore(), []),
  );

  if (leadingComments === undefined) {
    leadingComments = [
      'AUTO GENERATED CODE',
      "Run app-config with 'generate' command to regenerate this file",
    ];
  }

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
