import * as _ from 'lodash';
import { join } from 'path';
import { ConfigObject } from './config';
import {
  parseEnv,
  findParseableFile,
  findParseableFileSync,
  FileType,
} from './file-loader';

const envVarName = ['APP_CONFIG'];
const configFileName = ['.app-config', 'app-config'];
const secretsFileName = ['.app-config.secrets', 'app-config.secrets'];

export type ConfigObject = number | string | object | {
  [key: string]: ConfigObject;
};

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
  const [envVarConfig] = envVarName
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

  const secretsConfig = await findParseableFile(secretsFileName.map(f => join(cwd, f)));
  const secrets = secretsConfig ? secretsConfig[1] : {};

  const mainConfig = await findParseableFile(configFileName.map(f => join(cwd, f)));

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
  const [envVarConfig] = envVarName
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

  const secretsConfig = findParseableFileSync(secretsFileName.map(f => join(cwd, f)));
  const secrets = secretsConfig ? secretsConfig[1] : {};

  const mainConfig = findParseableFileSync(configFileName.map(f => join(cwd, f)));

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
