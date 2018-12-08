import * as _ from 'lodash';
import { join } from 'path';
import { ConfigObject } from './config';
import {
  FileType,
  parseEnv,
  parseFile,
  parseFileSync,
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

  const [secretsConfig] = (await Promise.all(
    secretsFileName.map(filename => parseFile(join(cwd, filename)).catch(_ => null)),
  )).filter(c => !!c);

  const secrets = secretsConfig ? secretsConfig[1] : {};

  const [mainConfig] = (await Promise.all(
    configFileName.map(filename => parseFile(join(cwd, filename)).catch(_ => null)),
  )).filter(c => !!c);

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

  const [secretsConfig] = secretsFileName
    .map(filename => {
      try {
        return parseFileSync(join(cwd, filename));
      } catch (_) {
        return null;
      }
    }).filter(c => !!c);

  const secrets = secretsConfig ? secretsConfig[1] : {};

  const [mainConfig] =
    configFileName.map(filename => {
      try {
        return parseFileSync(join(cwd, filename));
      } catch (_) {
        return null;
      }
    }).filter(c => !!c);

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
