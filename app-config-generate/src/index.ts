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
import { logger } from '@app-config/logging';
import { loadMetaConfig, MetaLoadingOptions } from '@app-config/meta';
import { loadSchema, JSONSchema, SchemaLoadingOptions } from '@app-config/schema';

export interface Options {
  directory?: string;
  schemaOptions?: SchemaLoadingOptions;
  metaOptions?: MetaLoadingOptions;
}

export async function generateTypeFiles({ directory, schemaOptions, metaOptions }: Options = {}) {
  const { schema } = await loadSchema({ directory, ...schemaOptions });
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
  leadingCommentsOverride?: string[],
  rendererOptions: RendererOptions = {},
): Promise<string[]> {
  const src: JSONSchemaSourceData = {
    name,
    schema: JSON.stringify(schema),
  };

  const inputData = new InputData();
  await inputData.addSource('schema', src, () => new JSONSchemaInput(undefined));

  let leadingComments = leadingCommentsOverride ?? [
    'AUTO GENERATED CODE',
    "Run app-config with 'generate' command to regenerate this file",
  ];

  if (['ts', 'typescript', 'flow'].includes(type)) {
    Object.assign(rendererOptions, {
      'just-types': 'true',
      'runtime-typecheck': 'false',
      ...rendererOptions,
    });
  }

  if (['rs', 'rust'].includes(type)) {
    leadingComments = [];
    Object.assign(rendererOptions, {
      'derive-debug': 'true',
      'edition-2018': 'true',
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
    lines.splice(leadingComments.length, 0, '', "import '@app-config/main';");

    // some configs are empty, so just mark them as an empty object
    if (!lines.some((line) => line.startsWith('export'))) {
      lines.push(`export interface ${name} {}\n`);
    }

    if (augmentModule !== false) {
      lines.push(
        ...[
          '// augment the default export from app-config',
          "declare module '@app-config/main' {",
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
      '  "errors"',
      '  "fmt"',
      '  "log"',
      '  "os"',
      '',
      '  "github.com/xeipuuv/gojsonschema"',
      ')',
    ];

    const singleton = stripIndent`
      var config ${name}

      func init() {
        loadedConfig, err := LoadConfig()

        if err != nil {
          log.Panic(err.Error())
        }

        config = loadedConfig
      }

      func GetConfig() ${name} {
        return config
      }
    `.split('\n');

    const loadConfig = stripIndent`
      func LoadConfig() (${name}, error) {
        var loadedConfig ${name}
        var loadedSchema map[string]interface{}
        var err error

        configText := os.Getenv("APP_CONFIG")
        schemaText := os.Getenv("APP_CONFIG_SCHEMA")

        if configText == "" {
          return loadedConfig, errors.New("The APP_CONFIG environment variable was not set")
        }

        if schemaText == "" {
          return loadedConfig, errors.New("The APP_CONFIG_SCHEMA environment variable was not set")
        }

        err = json.Unmarshal([]byte(schemaText), &loadedSchema)

        if err != nil {
          return loadedConfig, fmt.Errorf("Could not parse APP_CONFIG_SCHEMA environment variable: %s", err.Error())
        }

        err = json.Unmarshal([]byte(configText), &loadedConfig)

        if err != nil {
          return loadedConfig, fmt.Errorf("Could not parse APP_CONFIG environment variable: %s", err.Error())
        }

        schemaLoader := gojsonschema.NewGoLoader(loadedSchema)
        documentLoader := gojsonschema.NewGoLoader(loadedConfig)

        result, err := gojsonschema.Validate(schemaLoader, documentLoader)

        if err != nil {
          return loadedConfig, fmt.Errorf("Could not validate App Config: %s", err.Error())
        }

        if !result.Valid() {
          errors := ""

          for _, desc := range result.Errors() {
            if errors == "" {
              errors = fmt.Sprintf("%v", desc)
            } else {
              errors = fmt.Sprintf("%s, %v", errors, desc)
            }
          }

          return loadedConfig, fmt.Errorf("The App Config value invalid: %s", errors)
        }

        return loadedConfig, nil
      }
    `.split('\n');

    // specify no-singleton to avoid automatic config loading in init() function
    if (rendererOptions['no-singleton'] === 'true') {
      lines.splice(importIndex, 1, ...imports, '', ...loadConfig);
    } else {
      lines.splice(importIndex, 1, ...imports, '', ...singleton, ...loadConfig);
    }

    lines.splice(0, 0, '// @generated by app-config', '');

    // get close to gofmt
    return lines.map((line) =>
      line.replace(/ +$/g, '').replace(/^( {2})+/g, (match) => {
        return '\t'.repeat(match.length / 2);
      }),
    );
  }

  if (['rs', 'rust'].includes(type)) {
    const imports = ['use serde_derive::{Deserialize, Serialize};', 'use valico::json_schema;'];

    const loadConfig = [
      '#[derive(Debug)]',
      'pub enum Error {',
      "    EnvironmentVariableNotFound(&'static str),",
      '    JsonParsing(serde_json::Error),',
      '    Validation(json_schema::ValidationState),',
      '}',
      '',
      'pub fn load_config() -> Result<Config, Error> {',
      '    let config_text = match std::env::var("APP_CONFIG") {',
      '        Ok(text) => text,',
      '        Err(_) => {',
      '            return Err(Error::EnvironmentVariableNotFound("APP_CONFIG"));',
      '        }',
      '    };',
      '',
      '    let schema_text = match std::env::var("APP_CONFIG_SCHEMA") {',
      '        Ok(text) => text,',
      '        Err(_) => {',
      '            return Err(Error::EnvironmentVariableNotFound("APP_CONFIG_SCHEMA"));',
      '        }',
      '    };',
      '',
      '    let config = serde_json::from_str(&config_text).map_err(Error::JsonParsing)?;',
      '    let schema = serde_json::from_str(&schema_text).map_err(Error::JsonParsing)?;',
      '',
      '    let mut scope = json_schema::Scope::new();',
      '    let schema = scope.compile_and_return(schema, false).unwrap();',
      '    let result = schema.validate(&config);',
      '',
      '    if !result.is_valid() {',
      '        return Err(Error::Validation(result));',
      '    }',
      '',
      '    return serde_json::from_value(config).map_err(Error::JsonParsing);',
      '}',
      '',
      'impl std::error::Error for Error {}',
      '',
      'impl std::fmt::Display for Error {',
      "    fn fmt(&self, fmt: &mut std::fmt::Formatter<'_>) -> Result<(), std::fmt::Error> {",
      '        match self {',
      '            Error::EnvironmentVariableNotFound(var) => {',
      '                write!(fmt, "EnvironmentVariableNotFound({})", var)?;',
      '            }',
      '            Error::JsonParsing(error) => {',
      '                write!(fmt, "JSON Parsing Error: {}", error)?;',
      '            }',
      '            Error::Validation(state) => {',
      '                write!(fmt, "JSON Schema Validation Error: {:?}", state)?;',
      '            }',
      '        }',
      '',
      '        Ok(())',
      '    }',
      '}',
    ];

    for (const [ind, line] of lines.entries()) {
      lines[ind] = line.replace(/^( {2})/g, '    ');
    }

    const importsIndex = lines.findIndex((line) => line.startsWith('use serde::'));

    lines.splice(importsIndex, 1, ...imports);
    lines.splice(lines.length, 0, ...loadConfig);
  }

  return lines;
}
