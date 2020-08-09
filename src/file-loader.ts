import { extname, dirname, join, isAbsolute } from 'path';
import { readFile, pathExists } from 'fs-extra';
import * as TOML from '@iarna/toml';
import * as YAML from 'js-yaml';
import * as JSON5 from 'json5';
import { merge, mergeWith } from 'lodash';
import { decryptText } from './secrets';
import { ConfigObject, envAliases } from './config';
import { metaProps } from './meta';

export enum FileType {
  JSON = 'JSON',
  JSON5 = 'JSON5',
  TOML = 'TOML',
  YAML = 'YAML',
}

const envTypeVarNames = ['APP_CONFIG_ENV', 'ENV', 'NODE_ENV'];
const defaultFileTypes = [FileType.JSON, FileType.JSON5, FileType.TOML, FileType.YAML];

export const getEnvType = () => {
  const [envType] = envTypeVarNames
    .filter(envType => !!process.env[envType])
    .map(envType => process.env[envType]);

  return envType;
};

class FileNotFound extends Error {
  readonly path: string;
  constructor(path: string) {
    super(`FileNotFound(${path})`);
    this.path = path;
  }
}

type MetaProps = { [key: string]: ConfigObject };
type Path = string;

export const extToFileType = (ext: string, contents: string = ''): FileType => {
  switch (ext) {
    case 'toml':
      return FileType.TOML;
    case 'yaml':
    case 'yml':
      return FileType.YAML;
    case 'json':
      return FileType.JSON;
    case 'json5':
      return FileType.JSON5;
    default:
      if (contents) {
        return guessFileType(contents);
      }
  }

  throw new Error(`could not guess file type for ${ext}`);
};

export const fileTypeToExt = (fileType: FileType): string[] => {
  switch (fileType) {
    case FileType.JSON:
      return ['json'];
    case FileType.JSON5:
      return ['json5'];
    case FileType.TOML:
      return ['toml'];
    case FileType.YAML:
    default:
      return ['yml', 'yaml'];
  }
};

export const guessFileType = (contents: string): FileType => {
  try {
    JSON.parse(contents);
    return FileType.JSON;
  } catch (_) {
    /* expected */
  }

  try {
    JSON5.parse(contents);
    return FileType.JSON5;
  } catch (_) {
    /* expected */
  }

  try {
    TOML.parse(contents);
    return FileType.TOML;
  } catch (_) {
    /* expected */
  }

  try {
    YAML.safeLoad(contents);
    return FileType.YAML;
  } catch (_) {
    /* expected */
  }

  throw new Error('contents were not a valid FileType');
};

export const parseEnv = async (
  name: string,
  supportedFileTypes: FileType[] = defaultFileTypes,
  envOverride?: string,
  doDecryption = true,
): Promise<[FileType, ConfigObject]> => {
  const contents = process.env[name];

  if (!contents) {
    throw new Error(`No environment variable '${name}' found`);
  }

  const fileType = guessFileType(contents);

  if (!supportedFileTypes.includes(fileType)) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  const [, config, meta] = await parseString(contents, fileType, doDecryption, envOverride);

  if (meta.extends) {
    throw new Error('cannot extend in an env var config');
  }

  return [fileType, config];
};

export const parseFile = async (
  filePath: Path,
  supportedFileTypes: FileType[] = defaultFileTypes,
  envOverride?: string,
  doDecryption = true,
): Promise<[FileType, Path, ConfigObject]> => {
  let ext: string;
  let file = filePath;

  if (await pathExists(filePath)) {
    ext = extname(filePath)
      .toLowerCase()
      .slice(1);
  } else {
    const found = await Promise.all(
      supportedFileTypes.map(async fileType => {
        const exts = fileTypeToExt(fileType);
        const found = (
          await Promise.all(
            exts.map(async extension =>
              (await pathExists(`${filePath}.${extension}`)) ? extension : false,
            ),
          )
        ).filter(e => !!e);

        if (found.length > 1) {
          console.warn(`found multiple valid ${fileType} files ${filePath}`);
        }

        return found[0] || false;
      }),
    );

    const valid = found.filter(e => !!e);

    if (valid.length > 1) {
      console.warn(`found multiple valid files ${filePath}`);
    }

    if (valid.length === 0) {
      throw new FileNotFound(filePath);
    }

    ext = valid[0] as string;
    file += `.${ext}`;
  }

  // this is for node-dev, so that it knows that app-config is a dependency
  // this should have no effect on performance and is virtually side effect free
  try {
    // eslint-disable-next-line import/no-dynamic-require,global-require
    require(file);
  } catch (_) {
    /* expected */
  }

  const contents = (await readFile(file)).toString('utf8');
  const fileType = extToFileType(ext, contents);

  if (!supportedFileTypes.includes(fileType)) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  const [, parsed, meta] = await parseString(contents, fileType, doDecryption, envOverride);
  let config = parsed;

  if (meta.extends) {
    const extend = (Array.isArray(meta.extends) ? meta.extends : [meta.extends]) as string[];

    for (const filename of extend) {
      try {
        const filepath = isAbsolute(filename) ? filename : join(dirname(file), filename);
        const [, , ext] = await parseFile(filepath, supportedFileTypes, envOverride);
        config = merge(ext, config);
      } catch (e) {
        if (e instanceof FileNotFound) {
          throw new Error(`could not find extends: ${filename}`);
        }

        throw e;
      }
    }

    delete meta.extends;
  }

  if (meta.override) {
    const extend = (Array.isArray(meta.override) ? meta.override : [meta.override]) as string[];

    for (const filename of extend) {
      try {
        const filepath = isAbsolute(filename) ? filename : join(dirname(file), filename);
        const [, , override] = await parseFile(filepath, supportedFileTypes, envOverride);
        config = merge(config, override);
      } catch (e) {
        if (e instanceof FileNotFound) {
          throw new Error(`could not find override: ${filename}`);
        }

        throw e;
      }
    }

    delete meta.override;
  }

  if (meta.overrideOptional) {
    const extend = (Array.isArray(meta.overrideOptional)
      ? meta.overrideOptional
      : [meta.overrideOptional]) as string[];

    for (const filename of extend) {
      try {
        const filepath = isAbsolute(filename) ? filename : join(dirname(file), filename);
        const [, , overrideOptional] = await parseFile(filepath, supportedFileTypes, envOverride);
        config = merge(config, overrideOptional);
      } catch (e) {
        if (e instanceof FileNotFound) {
          continue; // this is expected, since it's overrideOptional
        }

        throw e;
      }
    }

    delete meta.overrideOptional;
  }

  return [fileType, file, config];
};

export const findParseableFile = async (
  files: Path[],
  supportedFileTypes: FileType[] = defaultFileTypes,
  envOverride?: string,
  doDecryption = true,
): Promise<[FileType, Path, ConfigObject] | undefined> => {
  const [valid, ...others] = (
    await Promise.all(
      files.map(async filename => {
        return parseFile(filename, supportedFileTypes, envOverride, doDecryption).catch(e => {
          if (!(e instanceof FileNotFound)) {
            throw e;
          }

          return undefined;
        });
      }),
    )
  ).filter(c => !!c);

  if (others.length) {
    console.warn(
      `found multiple valid files, only expected one. (${[valid, ...others]
        .map(file => file![1])
        .join(', ')})`,
    );
  }

  return valid;
};

export const parseString = async (
  contents: string,
  fileType: FileType,
  doDecryption: boolean,
  envOverride?: string,
): Promise<[FileType, ConfigObject, MetaProps]> => {
  switch (fileType) {
    case FileType.JSON: {
      const mappedConfig = await mapObject(JSON.parse(contents), doDecryption, envOverride);
      const [config, meta] = stripMetaProps(mappedConfig);
      return [FileType.JSON, config, meta];
    }
    case FileType.JSON5: {
      const mappedConfig = await mapObject(JSON5.parse(contents), doDecryption, envOverride);
      const [config, meta] = stripMetaProps(mappedConfig);
      return [FileType.JSON5, config, meta];
    }
    case FileType.TOML: {
      const mappedConfig = await mapObject(TOML.parse(contents), doDecryption, envOverride);
      const [config, meta] = stripMetaProps(mappedConfig);
      return [FileType.TOML, config, meta];
    }
    case FileType.YAML:
    default: {
      const mappedConfig = await mapObject(
        YAML.safeLoad(contents) ?? {},
        doDecryption,
        envOverride,
      );
      const [config, meta] = stripMetaProps(mappedConfig);
      return [FileType.YAML, config, meta];
    }
  }
};

export const stringify = (config: ConfigObject, fileType: FileType): string => {
  switch (fileType) {
    case FileType.JSON: {
      return JSON.stringify(config, null, 2);
    }
    case FileType.JSON5: {
      return JSON5.stringify(config, null, 2);
    }
    case FileType.TOML: {
      return TOML.stringify(config as any);
    }
    case FileType.YAML:
    default: {
      return YAML.safeDump(config);
    }
  }
};

const stripMetaProps = (config: any): [ConfigObject, MetaProps] => {
  const meta = config['app-config'] || {};

  Object.assign(metaProps, meta);
  delete config['app-config'];

  return [config, meta];
};

const mapObject = async (
  config: any,
  doDecryption: boolean,
  envOverride?: string,
  context?: string,
): Promise<any> => {
  if (typeof config === 'string') {
    let value: string = config;

    if (doDecryption) {
      if (value.startsWith('encrypted:')) {
        return decryptText(value);
      }
    }

    // this regex matches:
    //   $FOO
    //   ${FOO}
    //   ${FOO:-fallback}
    //   ${FOO:-${FALLBACK}}
    //
    // var name is group 1 || 2
    // fallback value is group 3
    // https://regex101.com/r/6ZMmx7/3
    const envVar = /\$(?:([a-zA-Z_]\w+)|(?:{([a-zA-Z_]\w+)(?::- *(.*?) *)?}))/g;

    while (true) {
      const match = envVar.exec(config);
      if (!match) break;

      const fullMatch = match[0];
      const varName = match[1] || match[2];
      const fallback = match[3];

      if (varName) {
        const env = process.env[varName];

        if (env !== undefined) {
          value = value.replace(fullMatch, env);
        } else if (fallback !== undefined) {
          // we'll recurse again, so that ${FOO:-${FALLBACK}} -> ${FALLBACK} -> value
          value = await mapObject(value.replace(fullMatch, fallback), doDecryption, envOverride);
        } else if (varName === 'APP_CONFIG_ENV') {
          const envType = envOverride ?? getEnvType();

          if (!envType) {
            throw new Error(`Could not find environment variable ${varName}`);
          }

          const aliased = Object.entries(envAliases).find(([, v]) => v.includes(envType));

          // there's a special case for APP_CONFIG_ENV, which is always the envType
          value = value.replace(fullMatch, aliased ? aliased[0] : envType);
        } else {
          throw new Error(`Could not find environment variable ${varName}`);
        }
      }
    }

    return value;
  }

  if (!config) {
    return config;
  }

  if (Array.isArray(config)) {
    return Promise.all(config.map(v => mapObject(v, doDecryption, envOverride)));
  }

  if (typeof config !== 'object') {
    return config;
  }

  for (const [key, value] of Object.entries(config)) {
    // we map $env: { production: 12, development: 14 } to 12 or 14
    if (key === '$env') {
      const rawEnv = envOverride ?? getEnvType();
      const envVariations = [rawEnv].concat(envAliases[rawEnv as any]).filter(env => !!env);
      const envValues = value as any;

      if (typeof envValues !== 'object') {
        throw new Error(
          "$env value must be an object with keys being 'default' or an environment name",
        );
      }

      let envSpecificValue: any;

      envVariations.forEach(env => {
        const envValue = envValues[env as any];

        if (envValue !== undefined) {
          if (envSpecificValue !== undefined) {
            throw new Error(
              `More than one value found for environment '${rawEnv}'. ` +
                'Remove additional declarations (includes aliases).',
            );
          }

          envSpecificValue = envValue;
        }
      });

      // $env: { default: value, ...} gets chosen when a matching environment
      // is not found in the provided options
      if (envSpecificValue === undefined) {
        envSpecificValue = envValues.default;
      }

      if (envSpecificValue === undefined) {
        if (rawEnv) {
          throw new Error(
            `No matching environment option found for '${rawEnv}' (${context ?? 'root'}). ` +
              `Please provide '${rawEnv}', an alias to '${rawEnv}', or 'default' option.`,
          );
        } else {
          throw new Error(
            `No environment provided, and no default option provided (${context ?? 'root'}). ` +
              'Please provide one.',
          );
        }
      }

      if (
        typeof envSpecificValue === 'object' &&
        envSpecificValue !== null &&
        !Array.isArray(envSpecificValue)
      ) {
        delete config.$env;
        mergeWith(config, await mapObject(envSpecificValue, doDecryption, envOverride), (a, b) =>
          Array.isArray(b) ? b : undefined,
        );
      } else {
        return mapObject(envSpecificValue, doDecryption, envOverride);
      }
    } else {
      const newVal = await mapObject(value, doDecryption, envOverride, key);

      if (typeof newVal === 'object' && newVal !== null && !Array.isArray(newVal)) {
        config[key] = mergeWith(config[key], newVal, (a, b) => (Array.isArray(b) ? b : undefined));
      } else {
        config[key] = newVal;
      }
    }
  }

  return config;
};
