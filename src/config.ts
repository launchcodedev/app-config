import * as _ from 'lodash';
import { join } from 'path';
import { ConfigObject } from './config';
import {
  parseEnv,
  findParseableFile,
  findParseableFileSync,
  FileType,
} from './file-loader';

const envVarNames = ['APP_CONFIG'];
const configFileNames = ['.app-config', 'app-config'];
const secretsFileNames = ['.app-config.secrets', 'app-config.secrets'];

export type ConfigObject = number | boolean | string | ConfigObjectArr | {
  [key: string]: ConfigObject;
};

interface ConfigObjectArr extends Array<ConfigObject> {}

export enum ConfigSource {
  File,
  EnvVar,
}

export type LoadedConfig = {
  source: ConfigSource,
  fileType: FileType,
  config: ConfigObject,
  secrets?: ConfigObject,
  nonSecrets: ConfigObject,
};

export const loadConfig = async (cwd = process.cwd()): Promise<LoadedConfig> => {
  const [envVarConfig] = envVarNames
    .filter(name => !!process.env[name])
    .map(envVar => parseEnv(envVar));

  if (envVarConfig) {
    const [fileType, config] = envVarConfig;

    return {
      fileType,
      config,
      source: ConfigSource.EnvVar,
      nonSecrets: config,
    };
  }

  const secretsConfig = await findParseableFile(secretsFileNames.map(f => join(cwd, f)));
  const secrets = secretsConfig ? secretsConfig[1] : {};

  const mainConfig = await findParseableFile(configFileNames.map(f => join(cwd, f)));

  if (!mainConfig) {
    throw new Error('Could not find app config. Expected an environment variable or file.');
  }

  const [fileType, nonSecrets] = mainConfig;

  return {
    fileType,
    secrets,
    nonSecrets,
    config: _.merge({}, nonSecrets, secrets),
    source: ConfigSource.File,
  };
};

export const loadConfigSync = (cwd = process.cwd()): LoadedConfig => {
  const [envVarConfig] = envVarNames
    .filter(name => !!process.env[name])
    .map(envVar => parseEnv(envVar));

  if (envVarConfig) {
    const [fileType, config] = envVarConfig;

    return {
      fileType,
      config,
      source: ConfigSource.EnvVar,
      nonSecrets: config,
    };
  }

  const secretsConfig = findParseableFileSync(secretsFileNames.map(f => join(cwd, f)));
  const secrets = secretsConfig ? secretsConfig[1] : {};

  const mainConfig = findParseableFileSync(configFileNames.map(f => join(cwd, f)));

  if (!mainConfig) {
    throw new Error('Could not find app config. Expected an environment variable or file.');
  }

  const [fileType, nonSecrets] = mainConfig;

  return {
    fileType,
    secrets,
    nonSecrets,
    config: _.merge({}, nonSecrets, secrets),
    source: ConfigSource.File,
  };
};
