import { basename, extname } from 'path';
import { readFile, readFileSync } from 'fs-extra';
import * as TOML from '@iarna/toml';
import * as YAML from 'js-yaml';
import * as JSON from 'json5';

export enum FileType {
  JSON = 'JSON',
  TOML = 'TOML',
  YAML = 'YAML',
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
        const [fileType] = guessFileType(contents);
        return fileType;
      }
  }

  throw new Error(`could not guess file type for ${ext}`);
};

export const guessFileType = (contents: string): [FileType, number | string | object] => {
  try {
    return [FileType.JSON, JSON.parse(contents)];
  } catch (_) {}

  try {
    return [FileType.TOML, TOML.parse(contents)];
  } catch (_) {}

  try {
    return [FileType.YAML, YAML.safeLoad(contents)];
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
): [FileType, number | string | object] => {
  const contents = process.env[name];

  if (!contents) {
    throw new Error(`No environment variable '${name}' found`);
  }

  const [fileType, parsed] = guessFileType(contents);

  if (!supportedFileTypes.includes(fileType)) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  return [fileType, parsed];
};

export const parseFile = async (
  filePath: string,
  supportedFileTypes: FileType[] = [
    FileType.JSON,
    FileType.TOML,
    FileType.YAML,
  ],
): Promise<[FileType, number | string | object]> => {
  const ext = extname(filePath).toLowerCase();
  const contents = (await readFile(filePath)).toString('utf8');
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
): [FileType, number | string | object] => {
  const ext = extname(filePath).toLowerCase();
  const contents = readFileSync(filePath).toString('utf8');
  const fileType = extToFileType(ext, contents);

  if (!supportedFileTypes.includes(fileType)) {
    throw new Error(`Unsupported file type: ${fileType}`);
  }

  return parseString(contents, fileType);
};

export const parseString = (
  contents: string,
  fileType: FileType,
): [FileType, number | string | object] => {
  switch (fileType) {
    case FileType.JSON:
      return [FileType.JSON, JSON.parse(contents)];
    case FileType.TOML:
      return [FileType.TOML, TOML.parse(contents)];
    case FileType.YAML:
      return [FileType.YAML, YAML.safeLoad(contents)];
  }
};
