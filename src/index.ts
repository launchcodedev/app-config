import * as fs from 'fs-extra';
import * as TOML from '@iarna/toml';
import * as Ajv from 'ajv';
import * as _ from 'lodash';

const configEnvVariableName = 'APP_CONFIG';
const configFileName = '.app-config.toml';
const secretsFileName = '.app-config.secrets.toml';
const schemaFileName = '.app-config.schema';

export const loadConfig = () => {
  // Try loading from environment variable first
  const envVariableString = process.env[configEnvVariableName];

  if (envVariableString) {
    try {
      return { config: TOML.parse(envVariableString), from: 'env' };
    } catch (err) {
      throw new Error(
        `Could not parse ${configEnvVariableName} environment variable. Expecting valid TOML`,
      );
    }
  }

  let secrets: object = {};
  try {
    secrets = TOML.parse(fs.readFileSync(secretsFileName).toString('utf8'));
  } catch (_) {}

  if (!fs.pathExistsSync(configFileName)) {
    throw new Error(
      `Could not find app config. Expecting ${
        configEnvVariableName
      } environment variable or ${
        configFileName
      } file`,
    );
  }

  const configString = fs.readFileSync(configFileName).toString('utf8');

  try {
    const config = TOML.parse(configString);
    return { config: _.merge({}, config, secrets), from: 'file', nonSecret: config };
  } catch (err) {
    throw new Error(
      `Could not parse ${configFileName} file. Expecting valid TOML`,
    );
  }
};

export const loadSchema = () => {
  if (fs.pathExistsSync(`${schemaFileName}.json`)) {
    return JSON.parse(fs.readFileSync(`${schemaFileName}.json`).toString('utf8'));
  }

  if (fs.pathExistsSync(`${schemaFileName}.toml`)) {
    return TOML.parse(fs.readFileSync(`${schemaFileName}.toml`).toString('utf8'));
  }

  throw new Error(
    `Could not find a valid JSON schema file (${schemaFileName}.{json,toml})`,
  );
};

export const validate = ({ config, from, nonSecret } = loadConfig(), schema = loadSchema()) => {
  const ajv = new Ajv();

  const schemaSecrets: string[][] = [];
  ajv.addKeyword('secret', {
    type: 'boolean',
    macro (val, _, ctx) {
      if (val) {
        // this looks like [undefined, '\'parentname\'', '\'childname\'']
        const property: string[] = (<any>ctx).dataPathArr;
        // transform into ['parentname', 'childname']
        const key = property.filter(v => v).map((v) => {
          const match = v.match(/^\'(.*)\'$/);
          return match ? match[1] : v;
        });

        schemaSecrets.push(key);
      }

      return false;
    },
  });

  const valid = ajv.validate(schema, config);

  // enforce that secrets are not in the main file
  if (from === 'file') {
    schemaSecrets.map(secretProperty =>
      secretProperty.reduce(({ obj, ctx }: { obj: any, ctx: string[] }, prop, i) => {
        if (i === secretProperty.length - 1 && obj[prop]) {
          throw new Error(`app-config file contained the secret: '.${[...ctx, prop].join('.')}'`);
        }

        return { obj: obj[prop], ctx: [...ctx, prop] };
      }, { obj: nonSecret, ctx: [] }),
    );
  }

  if (!valid) {
    const configError = new Error(
      `Config is invalid: ${ajv.errorsText(null, { dataVar: 'config' })}`,
    );

    configError.stack = undefined;

    throw configError;
  }

  return config;
};

const config = validate(loadConfig());

// Create empty 'Config' interface that can be augmented per project
export interface Config {}

export default config as Config;
