import * as _ from 'lodash';
import { join } from 'path';
import { ExportedConfig } from './index';
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

export type LoadedConfig<Conf = ConfigObject> = {
  source: ConfigSource,
  fileType: FileType,
  config: Conf,
  secrets?: ConfigObject,
  nonSecrets: ConfigObject,
};

export const loadConfig = async <C = ExportedConfig>(
  cwd = process.cwd(),
): Promise<LoadedConfig<C>> => {
  const [envVarConfig] = envVarNames
    .filter(name => !!process.env[name])
    .map(envVar => parseEnv(envVar));

  if (envVarConfig) {
    const [fileType, config] = envVarConfig;

    return {
      fileType,
      config: config as unknown as C,
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
    config: _.merge({}, nonSecrets, secrets) as unknown as C,
    source: ConfigSource.File,
  };
};

export const loadConfigSync = <C = ExportedConfig>(cwd = process.cwd()): LoadedConfig<C> => {
  const [envVarConfig] = envVarNames
    .filter(name => !!process.env[name])
    .map(envVar => parseEnv(envVar));

  if (envVarConfig) {
    const [fileType, config] = envVarConfig;

    return {
      fileType,
      config: config as unknown as C,
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
    config: _.merge({}, nonSecrets, secrets) as unknown as C,
    source: ConfigSource.File,
  };
};
