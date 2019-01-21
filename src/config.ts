import * as _ from 'lodash';
import { join } from 'path';
import {
  parseEnv,
  findParseableFile,
  findParseableFileSync,
  FileType,
} from './file-loader';
import { loadSchema, loadSchemaSync, validate } from './schema';

const envVarNames = ['APP_CONFIG'];
const configFileNames = ['.app-config', 'app-config'];
const secretsFileNames = ['.app-config.secrets', 'app-config.secrets'];
const globalConfigExtends = ['APP_CONFIG_CI', 'APP_CONFIG_EXTEND'];

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

export const loadConfig = async <C = ConfigObject>(
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

  const [globalConfigExtend] = globalConfigExtends
    .filter(name => !!process.env[name])
    .map(envVar => parseEnv(envVar));

  if (globalConfigExtend) {
    assignProperties(globalConfigExtend[1], nonSecrets as object, secrets as object);
  }

  return {
    fileType,
    secrets,
    nonSecrets,
    config: _.merge({}, nonSecrets, secrets) as unknown as C,
    source: ConfigSource.File,
  };
};

export const loadConfigSync = <C = ConfigObject>(cwd = process.cwd()): LoadedConfig<C> => {
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

  const [globalConfigExtend] = globalConfigExtends
    .filter(name => !!process.env[name])
    .map(envVar => parseEnv(envVar));

  if (globalConfigExtend) {
    assignProperties(globalConfigExtend[1], nonSecrets as object, secrets as object);
  }

  return {
    fileType,
    secrets,
    nonSecrets,
    config: _.merge({}, nonSecrets, secrets) as unknown as C,
    source: ConfigSource.File,
  };
};

const assignProperties = (globalConfig: any, nonSecrets: object, secrets: object, path = '') => {
  Object.entries(globalConfig).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      assignProperties(value, nonSecrets, secrets, `${path ? `${path}.` : ''}${key}`);
    } else {
      const propPath = `${path ? `${path}.` : ''}${key}`;

      if (_.get(nonSecrets, propPath)) {
        _.set(nonSecrets, propPath, value);
      } else {
        _.set(secrets, propPath, value);
      }
    }
  });
};
