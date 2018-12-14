import { basename, extname, dirname, join } from 'path';
import { readFile, readFileSync, pathExists, pathExistsSync } from 'fs-extra';
import * as TOML from '@iarna/toml';
import * as YAML from 'js-yaml';
import * as JSON from 'json5';
import { merge } from 'lodash';
import { ConfigObject } from './config';
import { metaProps } from './meta';

export enum FileType {
  JSON = 'JSON',
  TOML = 'TOML',
  YAML = 'YAML',
}

export enum CouldNotParse {
  FileNotFound = 'FileNotFound',
}

type MetaProps = { [key: string]: ConfigObject };

export const extToFileType = (ext: string, contents: string = ''): FileType => {
  switch (ext) {
    case 'toml':
      return FileType.TOML;
    case 'yaml':
    case 'yml':
      return FileType.YAML;
    case 'json':
    case 'json5':
      return FileType.JSON;
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
      return ['json', 'json5'];
    case FileType.TOML:
      return ['toml'];
    case FileType.YAML:
      return ['yml', 'yaml'];
  }
};

export const guessFileType = (contents: string): FileType => {
  try {
    JSON.parse(contents);
    return FileType.JSON;
  } catch (_) {}

  try {
    TOML.parse(contents);
    return FileType.TOML;
  } catch (_) {}

  try {
    YAML.safeLoad(contents);
    return FileType.YAML;
  } catch (_) {}

  throw new Error('contents were not a valid FileType');
};

export const parseEnv = (
  name: string,
  supportedFileTypes: FileType[] = [
    FileType.JSON,
    FileType.TOML,
    FileType.YAML,
  ],
): [FileType, ConfigObject] => {
  const contents = process.env[name];

  if (!contents) {
    throw new Error(`No environment variable '${name}' found`);
  }

  const fileType = guessFileType(contents);

  if (!supportedFileTypes.includes(fileType)) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  const [_, config, meta] = parseString(contents, fileType);

  if (meta.extends) {
    throw new Error('cannot extend in an env var config');
  }

  return [fileType, config];
};

export const parseFile = async (
  filePath: string,
  supportedFileTypes: FileType[] = [
    FileType.JSON,
    FileType.TOML,
    FileType.YAML,
  ],
): Promise<[FileType, ConfigObject]> => {
  let ext: string;
  let file = filePath;

  if (await pathExists(filePath)) {
    ext = extname(filePath).toLowerCase().slice(1);
  } else {
    const found = await Promise.all(supportedFileTypes
      .map(async (fileType) => {
        const exts = fileTypeToExt(fileType);
        const found = (await Promise.all(exts.map(async extension =>
          (await pathExists(`${filePath}.${extension}`)) ? extension : false,
        ))).filter(e => !!e);

        if (found.length > 1) {
          console.warn(`found multiple valid ${fileType} files ${filePath}`);
        }

        return found[0] || false;
      }));

    const valid = found.filter(e => !!e);

    if (valid.length > 1) {
      console.warn(`found multiple valid files ${filePath}`);
    }

    if (valid.length === 0) {
      throw CouldNotParse.FileNotFound;
    }

    ext = valid[0] as string;
    file += `.${ext}`;
  }

  const contents = (await readFile(file)).toString('utf8');
  const fileType = extToFileType(ext, contents);

  if (!supportedFileTypes.includes(fileType)) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  const [_, config, meta] = parseString(contents, fileType);

  if (meta.extends) {
    const extend = (Array.isArray(meta.extends) ? meta.extends : [meta.extends]) as string[];

    await extend.reduce(async (prev: Promise<void>, filename) => {
      await prev;

      try {
        const [_, ext] = await parseFile(join(dirname(file), filename));
        merge(config, ext);
      } catch (e) {
        if (e === CouldNotParse.FileNotFound) {
          throw new Error(`could not find extends: ${filename}`);
        }

        throw e;
      }
    }, Promise.resolve());

    delete meta.extends;
  }

  return [fileType, config];
};

export const parseFileSync = (
  filePath: string,
  supportedFileTypes: FileType[] = [
    FileType.JSON,
    FileType.TOML,
    FileType.YAML,
  ],
): [FileType, ConfigObject] => {
  let ext: string;
  let file = filePath;

  if (pathExistsSync(filePath)) {
    ext = extname(filePath).toLowerCase().slice(1);
  } else {
    const found = supportedFileTypes.map((fileType) => {
      const found = fileTypeToExt(fileType).map(extension =>
        (pathExistsSync(`${filePath}.${extension}`)) ? extension : false,
      ).filter(e => !!e);

      if (found.length > 1) {
        console.warn(`found multiple valid ${fileType} files ${filePath}`);
      }

      return found[0] || false;
    });

    const valid = found.filter(e => !!e);

    if (valid.length === 0) {
      throw CouldNotParse.FileNotFound;
    }

    if (valid.length > 1) {
      console.warn(`found multiple valid files ${filePath}`);
    }

    ext = valid[0] as string;
    file += `.${ext}`;
  }

  const contents = readFileSync(file).toString('utf8');
  const fileType = extToFileType(ext, contents);

  if (!supportedFileTypes.includes(fileType)) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  const [_, config, meta] = parseString(contents, fileType);

  if (meta.extends) {
    const extend = (Array.isArray(meta.extends) ? meta.extends : [meta.extends]) as string[];

    extend.forEach((filename) => {
      try {
        const [_, ext] = parseFileSync(join(dirname(file), filename));
        merge(config, ext);
      } catch (e) {
        if (e === CouldNotParse.FileNotFound) {
          throw new Error(`could not find extends: ${filename}`);
        }

        throw e;
      }
    });

    delete meta.extends;
  }

  return [fileType, config];
};

export const findParseableFile = async (
  files: string[],
): Promise<[FileType, ConfigObject] | undefined> => {
  const [valid, ...others] = (await Promise.all(files.map(async (filename) => {
    return parseFile(filename).catch((e) => {
      if (e !== CouldNotParse.FileNotFound) {
        throw e;
      }

      return undefined;
    });
  }))).filter(c => !!c);

  if (others.length) {
    console.warn(`found multiple valid files, only expected one. (${files.join(', ')})`);
  }

  return valid;
};

export const findParseableFileSync = (
  files: string[],
): [FileType, ConfigObject] | undefined => {
  const [valid, ...others] = files.map((filename) => {
    try {
      return parseFileSync(filename);
    } catch (e) {
      if (e !== CouldNotParse.FileNotFound) {
        throw e;
      }

      return undefined;
    }
  }).filter(c => !!c);

  if (others.length) {
    console.warn(`found multiple valid files, only expected one. (${files.join(', ')})`);
  }

  return valid;
};

export const parseString = (
  contents: string,
  fileType: FileType,
): [FileType, ConfigObject, MetaProps] => {
  switch (fileType) {
    case FileType.JSON: {
      const [config, meta] = stripMetaProps(JSON.parse(contents));
      return [FileType.JSON, config, meta];
    }
    case FileType.TOML: {
      const [config, meta] = stripMetaProps(TOML.parse(contents));
      return [FileType.TOML, config, meta];
    }
    case FileType.YAML: {
      const [config, meta] = stripMetaProps(YAML.safeLoad(contents) || {});
      return [FileType.YAML, config, meta];
    }
  }
};

const stripMetaProps = (config: any): [ConfigObject, MetaProps] => {
  const meta = config['app-config'] || {};

  Object.assign(metaProps, meta);
  delete config['app-config'];

  return [config, meta];
};
