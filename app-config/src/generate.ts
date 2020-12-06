import { extname, join } from 'path';
import { outputFile } from 'fs-extra';
import { stripIndent } from 'common-tags';
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

  if (['go', 'golang'].includes(type)) {
    const importIndex = lines.findIndex((line) => line.startsWith('import '));

    const imports = [
      'import (',
      '  "encoding/json"',
      '  "log"',
      '  "os"',
      '  "path/filepath"',
      '',
      '  "github.com/xeipuuv/gojsonschema"',
      ')',
    ];

    const singleton = stripIndent`
      var config ${name}

      func init() {
        envValue := os.Getenv("APP_CONFIG")

        if envValue == "" {
          log.Panic("The APP_CONFIG environment variable was undefined")
        }

        loaded, err := UnmarshalConfig([]byte(envValue))

        if err != nil {
          log.Panic("Could not parse APP_CONFIG environment variable: ", err)
        }

        schemaPath, err := filepath.Abs(".app-config.schema.json")

        if err != nil {
          log.Panic("Could not find .app-config.schema.json file: ", err)
        }

        schemaLoader := gojsonschema.NewReferenceLoader("file://" + schemaPath)
        documentLoader := gojsonschema.NewGoLoader(loaded)

        result, err := gojsonschema.Validate(schemaLoader, documentLoader)

        if err != nil {
          log.Panic("Could not validate app-config: ", err.Error())
        }

        if !result.Valid() {
          for _, desc := range result.Errors() {
            log.Printf("- %s\\n", desc)
          }

          log.Panic("The app-config value was not valid.")
        }

        config = loaded
      }

      func GetConfig() ${name} {
        return config
      }
    `.split('\n');

    lines.splice(importIndex, 1, ...imports, '', ...singleton);
    lines.splice(0, 0, '// @generated by app-config', '');

    // get close to gofmt
    return lines.map((line) =>
      line.replace(/ +$/g, '').replace(/^( {2})+/g, (match) => {
        return '\t'.repeat(match.length / 2);
      }),
    );
  }

  return lines;
}
