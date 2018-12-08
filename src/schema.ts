import * as Ajv from 'ajv';
import * as _ from 'lodash';
import { ConfigObject } from './common';

export enum InvalidConfig {
  InvalidSchema,
  SecretInNonSecrets,
  SchemaValidation,
}

export enum ConfigSource {
  File,
  EnvVar,
}

export type ConfigInput = {
  schema: object;
  source: ConfigSource;
  // !config means (secrets || nonSecrets)
  config?: ConfigObject;
  secrets?: ConfigObject;
  nonSecrets?: ConfigObject;
};

export const validate = (input: ConfigInput): [InvalidConfig, Error] | false  => {
  const {
    source,
    secrets,
    nonSecrets,
  } = input;

  const ajv = new Ajv();

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

  let { config } = input;

  if (config === undefined) {
    config = {
      ...((typeof nonSecrets === 'object') ? nonSecrets : {}),
      ...((typeof secrets === 'object') ? secrets : {}),
    };
  }

  const schema = input.schema as { [key: string]: ConfigObject };

  if (typeof schema !== 'object') {
    return [InvalidConfig.InvalidSchema, new Error('schema was not an object')];
  }

  if (!schema.$schema) {
    // default to draft 07
    schema.$schema = 'http://json-schema.org/draft-07/schema#';
  }

  const validate = ajv.compile(schema);
  const valid = validate(config);

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
