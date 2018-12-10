import { basename, extname } from 'path';
import { readFile, readFileSync, pathExists, pathExistsSync } from 'fs-extra';
import * as TOML from '@iarna/toml';
import * as YAML from 'js-yaml';
import * as JSON from 'json5';
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

  return parseString(contents, fileType);
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

  return parseString(contents, fileType);
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

  return parseString(contents, fileType);
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
    console.warn(`found multiple valid files, only expected one. (${others.join(', ')})`);
  }

  return valid;
};

export const parseString = (
  contents: string,
  fileType: FileType,
): [FileType, ConfigObject] => {
  switch (fileType) {
    case FileType.JSON:
      return [FileType.JSON, stripMetaProps(JSON.parse(contents))];
    case FileType.TOML:
      return [FileType.TOML, stripMetaProps(TOML.parse(contents))];
    case FileType.YAML:
      return [FileType.YAML, stripMetaProps(YAML.safeLoad(contents) || {})];
  }
};

const stripMetaProps = (c: any): ConfigObject => {
  // meta properties, not actually a part of the config / schema
  Object.assign(metaProps, c['app-config']);
  delete c['app-config'];

  return c;
};
