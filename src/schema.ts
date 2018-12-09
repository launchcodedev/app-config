import * as Ajv from 'ajv';
import * as _ from 'lodash';
import { outputFile } from 'fs-extra';
import { join, basename, extname } from 'path';
import { ConfigObject, ConfigSource, LoadedConfig } from './config';
import {
  parseFile,
  parseFileSync,
  findParseableFile,
  findParseableFileSync,
  getMetaProps,
} from './file-loader';
import {
  quicktype,
  JSONSchemaInput,
  JSONSchemaSourceData,
  InputData,
} from 'quicktype-core';

const schemaFileName = ['.app-config.schema', 'app-config.schema'];

export enum InvalidConfig {
  InvalidSchema,
  SecretInNonSecrets,
  SchemaValidation,
}

export type ConfigInput = { schema: ConfigObject } & LoadedConfig;

export const validate = (input: ConfigInput): [InvalidConfig, Error] | false  => {
  const {
    source,
    config,
    secrets,
    nonSecrets,
  } = input;

  const ajv = new Ajv({
    allErrors: true,
  });

  // array of property paths that should only be present in secrets file
  const schemaSecrets: string[] = [];

  ajv.addKeyword('secret', {
    validate(schema: any, data: any, parentSchema?: object, dataPath?: string) {
      if (!dataPath) {
        return false;
      }

      const [_, ...key] = dataPath.split('.');
      schemaSecrets.push(key.join('.'));

      return schema === true;
    },
  });

  const schema = input.schema as { [key: string]: ConfigObject };

  if (typeof schema !== 'object') {
    return [InvalidConfig.InvalidSchema, new Error('schema was not an object')];
  }

  if (!schema.$schema) {
    // default to draft 07
    schema.$schema = 'http://json-schema.org/draft-07/schema#';
  }

  const valid = ajv.validate(schema, config);

  if (source === ConfigSource.File && nonSecrets) {
    // check that the nonSecrets does not contain any properties marked as secret
    const secretsInNonSecrets = schemaSecrets.filter((secret) => {
      if (_.get(nonSecrets, secret)) {
        return secret;
      }
    });

    if (secretsInNonSecrets.length > 0) {
      return [
        InvalidConfig.SecretInNonSecrets,
        new Error(
          `Found ${secretsInNonSecrets.map(s => `'.${s}'`).join(', ')} in non secrets file`,
        ),
      ];
    }
  }

  if (!valid) {
    const err = new Error(
      `Config is invalid: ${ajv.errorsText(null, { dataVar: 'config' })}`,
    );

    err.stack = undefined;

    return [InvalidConfig.SchemaValidation, err];
  }

  return false;
};

export const loadSchema = async (cwd = process.cwd()): Promise<ConfigObject> => {
  const schema = await findParseableFile(schemaFileName.map(f => join(cwd, f)));

  if (!schema) {
    throw new Error('Could not find app config schema.');
  }

  return schema[1];
};

export const loadSchemaSync = (cwd = process.cwd()): ConfigObject => {
  const schema = findParseableFileSync(schemaFileName.map(f => join(cwd, f)));

  if (!schema) {
    throw new Error('Could not find app config schema.');
  }

  return schema[1];
};

export const generateTypeFiles = async (cwd = process.cwd()) => {
  type GenerateTypes = { type: string, file: string };

  const schema = await loadSchema(cwd);

  const {
    generate = [],
  } = getMetaProps() as { generate: GenerateTypes[] };

  await Promise.all(generate.map(async ({ type, file }) => {
    const src = {
      name: basename(file, extname(file)),
      schema: JSON.stringify(schema),
    } as JSONSchemaSourceData;

    const input = new JSONSchemaInput(undefined);
    await input.addSource(src);

    const inputData = new InputData();
    inputData.addInput(input);

    const { lines } = await quicktype({
      inputData,
      lang: type,
      indentation: '  ',
      leadingComments: [
        'AUTO GENERATED CODE',
        'Run app-config with --generate to regenerate this file',
      ],
      rendererOptions: {
        'just-types': 'true',
        'runtime-typecheck': 'false',
      },
    });

    await outputFile(join(cwd, file), lines.join('\n'));
  }));
};
