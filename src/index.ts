import * as fs from 'fs';
import * as TOML from '@iarna/toml';
import * as Ajv from 'ajv';

const configEnvVariableName = 'APP_CONFIG';
const configFileName = '.app-config.toml';
const schemaFileName = '.app-config.schema.json';

const loadConfig = () => {
  // Try loading from environment variable first
  const envVariableString = process.env[configEnvVariableName];

  if (envVariableString) {
    try {
      return TOML.parse(envVariableString);
    } catch (err) {
      throw new Error(
        `Could not parse ${configEnvVariableName} environment variable. Expecting valid TOML`,
      );
    }
  }

  // Next try loading from file
  let fileBuffer;

  try {
    fileBuffer = fs.readFileSync(configFileName);
  } catch (err) {}

  if (fileBuffer) {
    try {
      return TOML.parse(fileBuffer.toString('utf8'));
    } catch (err) {
      throw new Error(
        `Could not parse ${configFileName} file. Expecting valid TOML`,
      );
    }
  }

  throw new Error(
    `Could not find app config. Expecting ${
      configEnvVariableName
    } environment variable or ${
      configFileName
    } file`,
  );
};

const loadSchema = () => {
  let fileBuffer;

  try {
    fileBuffer = fs.readFileSync(schemaFileName);
  } catch (err) {}

  if (fileBuffer) {
    try {
      return JSON.parse(fileBuffer.toString('utf8'));
    } catch (err) {
      throw new Error(
        `Could not parse ${schemaFileName} file. Expecting valid JSON`,
      );
    }
  }

  throw new Error(
    `Could not find ${schemaFileName} JSON schema file`,
  );
};

let validConfig: any;

const getConfig = <T = any>(): T => {
  // If we've already loaded and validated the config, return it
  if (validConfig !== undefined) {
    return validConfig;
  }

  const config = loadConfig();
  const schema = loadSchema();

  const ajv = new Ajv();
  const valid = ajv.validate(schema, config);

  if (!valid) {
    const configError = new Error(
      `Config is invalid: ${ajv.errorsText(null, { dataVar: 'config' })}`,
    );

    configError.stack = undefined;

    throw configError;
  }

  validConfig = config;

  return validConfig as T;
};

export default getConfig;
