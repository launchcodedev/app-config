import * as _ from 'lodash';
import { join } from 'path';
import {
  parseEnv,
  findParseableFile,
  findParseableFileSync,
  FileType,
} from './file-loader';

const envVarNames = ['APP_CONFIG'];
const configFileNames = ['.app-config', 'app-config'];
const secretsFileNames = ['.app-config.secrets', 'app-config.secrets'];
const globalConfigExtends = ['APP_CONFIG_CI', 'APP_CONFIG_EXTEND'];
const envs = ['NODE_ENV', 'ENV', 'APP_CONFIG_ENV'];

interface ConfigObjectArr extends Array<ConfigSubObject> {}
export type ConfigSubObject = number | boolean | string | ConfigObjectArr | ConfigObject;
export type ConfigObject = {
  [key: string]: ConfigSubObject;
};

export enum ConfigSource {
  File,
  EnvVar,
}

export type LoadedConfig<Conf = ConfigObject> = {
  source: ConfigSource,
  fileType: FileType,
  fileSource?: string;
  config: Conf,
  secrets?: ConfigObject,
  nonSecrets: ConfigObject,
};

const envAliases: {[ key: string ]: string[]} = {
  production: ['prod'],
  development: ['dev'],
};

const getEnvFileNames = (files: string[]) => {
  const [env] = envs
    .filter(env => !!process.env[env])
    .map(env => process.env[env]);
  const envFiles = [env, ...(envAliases[env as string] || [])];

  return envFiles.reduce((filenames: string[], envFile) => filenames.concat(
    files.map(f => `${f}.${envFile}`),
  ), []);
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

  const secretEnvConfigFileNames = getEnvFileNames(secretsFileNames);
  const secretsConfig = await findParseableFile(
    secretEnvConfigFileNames.concat(secretsFileNames).map(f => join(cwd, f)),
  );
  const secrets = secretsConfig ? secretsConfig[2] : {};

  const envConfigFileNames = getEnvFileNames(configFileNames);
  const mainConfig = await findParseableFile(
    envConfigFileNames.concat(configFileNames).map(f => join(cwd, f)),
  );

  if (!mainConfig) {
    throw new Error('Could not find app config. Expected an environment variable or file.');
  }

  const [fileType, fileSource, nonSecrets] = mainConfig;

  const [globalConfigExtend] = globalConfigExtends
    .filter(name => !!process.env[name])
    .map(envVar => parseEnv(envVar));

  if (globalConfigExtend) {
    assignProperties(globalConfigExtend[1], nonSecrets as object, secrets as object);
  }

  return {
    fileType,
    fileSource,
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

  const secretEnvConfigFileNames = getEnvFileNames(secretsFileNames);
  const secretsConfig = findParseableFileSync(
    secretEnvConfigFileNames.concat(secretsFileNames).map(f => join(cwd, f)),
  );
  const secrets = secretsConfig ? secretsConfig[2] : {};

  const envConfigFileNames = getEnvFileNames(configFileNames);
  const mainConfig = findParseableFileSync(
    envConfigFileNames.concat(configFileNames).map(f => join(cwd, f)),
  );

  if (!mainConfig) {
    throw new Error('Could not find app config. Expected an environment variable or file.');
  }

  const [fileType, fileSource, nonSecrets] = mainConfig;

  const [globalConfigExtend] = globalConfigExtends
    .filter(name => !!process.env[name])
    .map(envVar => parseEnv(envVar));

  if (globalConfigExtend) {
    assignProperties(globalConfigExtend[1], nonSecrets as object, secrets as object);
  }

  return {
    fileType,
    fileSource,
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
