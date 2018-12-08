import { ConfigObject } from './config';
import {
  FileType,
  parseEnv,
  parseFile,
} from './file-loader';

const envVarName = ['APP_CONFIG'];
const fileName = ['.app-config', 'app-config'];
const secretsFileName = ['.app-config.secrets', 'app-config.secrets'];
const schemaFileName = ['.app-config.schema', 'app-config.schema'];

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

export const loadConfig = async (): Promise<LoadedConfig> => {
  const envVarConfig = envVarName.map((envVar) => {
    try {
      return parseEnv(envVar);
    } catch (_) {
      return false;
    }
  }).find(e => !!e);

  if (envVarConfig) {
    const [fileType, config] = envVarConfig;

    return {
      fileType,
      config,
      source: ConfigSource.EnvVar,
      nonSecrets: config,
    };
  }

  throw new Error();
};
