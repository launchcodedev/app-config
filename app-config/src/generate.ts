import { extname, join } from 'path';
import { outputFile } from 'fs-extra';
import {
  quicktype,
  RendererOptions,
  JSONSchemaInput,
  JSONSchemaSourceData,
  InputData,
} from 'quicktype-core';
import { loadMetaConfig, Options as MetaOptions } from './meta';
import { loadSchema, JSONSchema, Options as SchemaOptions } from './schema';
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
  const { value: schema } = await loadSchema({ directory, ...schemaOptions });
  const {
    value: { generate = [] },
  } = await loadMetaConfig({ directory, ...metaOptions });

  const metaDirectory = metaOptions?.directory ?? directory ?? '.';

  await Promise.all(
    generate.map(
      async ({
        file,
        type = extname(file).slice(1),
        name = 'Config',
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
        );

        await outputFile(join(metaDirectory, file), `${lines.join('\n')}${'\n'}`);
      },
    ),
  );

  return generate;
}

export async function generateQuicktype(
  schema: JSONSchema,
  type: string,
  name: string,
  augmentModule: boolean = true,
  leadingComments: string[] = [
    'AUTO GENERATED CODE',
    "Run app-config with 'generate' command to regenerate this file",
  ],
  rendererOptions: RendererOptions = {},
): Promise<string[]> {
  const src: JSONSchemaSourceData = {
    name,
    schema: JSON.stringify(schema),
  };

  const inputData = new InputData();
  await inputData.addSource('schema', src, () => new JSONSchemaInput(undefined));

  if (['ts', 'typescript', 'flow'].includes(type)) {
    Object.assign(rendererOptions, {
      'just-types': 'true',
      'runtime-typecheck': 'false',
      ...rendererOptions,
    });
  }

  const { lines } = await quicktype({
    inputData,
    lang: type,
    indentation: '  ',
    leadingComments,
    rendererOptions,
  });

  if (['ts', 'typescript'].includes(type)) {
    lines.splice(leadingComments.length, 0, '', "import '@lcdev/app-config';");

    // some configs are empty, so just mark them as an empty object
    if (!lines.some((line) => line.startsWith('export'))) {
      lines.push(`export interface ${name} {}\n`);
    }

    if (augmentModule !== false) {
      lines.push(
        ...[
          '// augment the default export from app-config',
          "declare module '@lcdev/app-config' {",
          `  export interface ExportedConfig extends ${name} {}`,
          '}',
        ],
      );
    }

    return (
      lines
        // this is a fix for quicktype, which adds an Object postfix, sometimes
        .map((line) => line.replace(`interface ${name}Object`, `interface ${name}`))
        .map((line) => line.replace(`: Date`, `: string`))
        .map((line) => line.replace(/: +(\w)/, ': $1'))
    );
  }

  if (['rb', 'ruby'].includes(type)) {
    const configLoading = [
      "config_text = ENV['APP_CONFIG']",
      "schema_text = ENV['APP_CONFIG_SCHEMA']",
      '',
      'if config_text == nil',
      '  raise "No APP_CONFIG variable"',
      'end',
      '',
      'if schema_text == nil',
      '  raise "No APP_CONFIG_SCHEMA variable"',
      'end',
      '',
      '# TODO: test json-schema',
      '$APP_CONFIG = Config::from_json!(config_text)',
    ];

    lines.splice(lines.length, 0, ...configLoading);

    return lines.map((line) => line.replace('include Dry::Types.module', 'include Dry::Types()'));
  }

  return lines;
}
