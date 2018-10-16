import * as fs from 'fs-extra';
import * as TOML from '@iarna/toml';
import * as Ajv from 'ajv';

const configEnvVariableName = 'APP_CONFIG';
const configFileName = '.app-config.toml';
const schemaFileName = '.app-config.schema';

export const loadConfig = () => {
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
  const fileExists = fs.pathExistsSync(configFileName);

  if (!fileExists) {
    throw new Error(
      `Could not find app config. Expecting ${
        configEnvVariableName
      } environment variable or ${
        configFileName
      } file`,
    );
  }

  const fileBuffer = fs.readFileSync(configFileName);

  try {
    return TOML.parse(fileBuffer.toString('utf8'));
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

const ajv = new Ajv();

export const validate = (config = loadConfig(), schema = loadSchema()) => {
  const valid = ajv.validate(schema, config);

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
