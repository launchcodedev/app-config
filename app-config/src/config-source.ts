import { resolve, extname } from 'path';
import { readFile, pathExists } from 'fs-extra';
import merge from 'lodash.merge';
import { parse as parseTOML, stringify as stringifyTOML } from '@iarna/toml';
import { safeLoad as parseYAML, safeDump as stringifyYAML } from 'js-yaml';
import { parse as parseJSON5, stringify as stringifyJSON5 } from 'json5';
import { Json, JsonObject } from './common';
import { currentEnvironment, defaultAliases } from './environment';
import { FileParsingExtension } from './extensions';
import { ParsedValue } from './parsed-value';
import { logger } from './logging';

export class NotFoundError extends Error {}

export enum FileType {
  YAML = 'YAML',
  TOML = 'TOML',
  JSON = 'JSON',
  JSON5 = 'JSON5',
}

/** Base class for "sources", which are strategies to read configuration (eg. files, environment variables) */
export abstract class ConfigSource {
  protected abstract readContents(): Promise<[string, FileType]>;

  async readValue(): Promise<Json> {
    const [contents, fileType] = await this.readContents();

    return parseRawString(contents, fileType);
  }

  async read(extensions?: FileParsingExtension[]): Promise<ParsedValue> {
    logger.verbose('Reading ConfigSource');
    const rawValue = await this.readValue();

    return ParsedValue.parse(rawValue, this, extensions);
  }

  async readToJSON(extensions?: FileParsingExtension[]): Promise<Json> {
    const parsed = await this.read(extensions);

    return parsed.toJSON();
  }
}

/** Read configuration from file */
export class FileSource extends ConfigSource {
  public readonly filePath: string;
  public readonly fileType: FileType;

  constructor(filePath: string, fileType?: FileType) {
    super();

    this.filePath = resolve(filePath);
    this.fileType = fileType ?? filePathAssumedType(this.filePath);
  }

  async readContents(): Promise<[string, FileType]> {
    try {
      const content = await readFile(this.filePath);

      return [content.toString('utf-8'), this.fileType];
    } catch (err) {
      if (err?.code === 'ENOENT') throw new NotFoundError(`File ${this.filePath} not found`);

      throw err;
    }
  }
}

/** Read configuration from a file, found via "glob-like" search */
export class FlexibleFileSource extends ConfigSource {
  constructor(private readonly filePath: string, private readonly environmentOverride?: string) {
    super();
  }

  private async resolveSource() {
    const environment = this.environmentOverride ?? currentEnvironment();
    const environmentAlias = Object.entries(defaultAliases).find(([, v]) => v === environment)?.[0];

    const filesToTry = [];

    for (const ext of ['yml', 'yaml', 'json', 'toml', 'json5']) {
      if (environment) filesToTry.push(`${this.filePath}.${environment}.${ext}`);
      if (environmentAlias) filesToTry.push(`${this.filePath}.${environmentAlias}.${ext}`);
    }

    // try these after trying environments
    for (const ext of ['yml', 'yaml', 'json', 'toml', 'json5']) {
      filesToTry.push(`${this.filePath}.${ext}`);
    }

    for (const filepath of filesToTry) {
      if (await pathExists(filepath)) {
        return new FileSource(filepath);
      }
    }

    throw new NotFoundError(`FlexibleFileSource could not find file with ${this.filePath}.{ext}`);
  }

  async readContents(): Promise<[string, FileType]> {
    return this.resolveSource().then((source) => source.readContents());
  }

  async read(extensions?: FileParsingExtension[]): Promise<ParsedValue> {
    const source = await this.resolveSource();

    return source.read(extensions);
  }
}

/** Read configuration from an environment variable */
export class EnvironmentSource extends ConfigSource {
  constructor(private readonly variableName: string) {
    super();
  }

  async readContents(): Promise<[string, FileType]> {
    const value = process.env[this.variableName];

    if (!value) {
      throw new NotFoundError(`Could not read the environment variable '${this.variableName}'`);
    }

    const inferredFileType = await guessFileType(value);

    return [value, inferredFileType];
  }
}

/** Read configuration from a literal JS object */
export class LiteralSource extends ConfigSource {
  constructor(private readonly value: Json) {
    super();
  }

  async readValue(): Promise<Json> {
    return this.value; // overriden to avoid stringify-parse cycle
  }

  async readContents(): Promise<[string, FileType]> {
    return [JSON.stringify(this.value), FileType.JSON];
  }
}

/** Read configuration from many ConfigSources and merge them */
export class CombinedSource extends ConfigSource {
  constructor(private readonly sources: ConfigSource[]) {
    super();

    if (sources.length === 0) throw new Error('CombinedSource requires at least one source');
  }

  async readValue(): Promise<Json> {
    const values = await Promise.all(this.sources.map((source) => source.readValue()));

    return values.reduce((acc, v) => merge(acc, v), {});
  }

  async readContents(): Promise<[string, FileType]> {
    const value = await this.readValue();

    return [JSON.stringify(value), FileType.JSON];
  }

  async read(extensions?: FileParsingExtension[]): Promise<ParsedValue> {
    const values = await Promise.all(this.sources.map((source) => source.read(extensions)));

    const merged = values.reduce<ParsedValue | undefined>((acc, parsed) => {
      if (!acc) return parsed;
      return acc.merge(parsed);
    }, undefined);

    if (!merged) throw new Error('Unreachable');

    Object.assign(merged, { source: this });

    return merged;
  }
}

/** Read configuration from the first ConfigSource that doesn't fail */
export class FallbackSource extends ConfigSource {
  constructor(private readonly sources: ConfigSource[]) {
    super();

    if (sources.length === 0) throw new Error('FallbackSource requires at least one source');
  }

  async readValue(): Promise<Json> {
    // take the first value that comes back without an error
    for (const source of this.sources) {
      try {
        const value = await source.readValue();

        return value;
      } catch (error) {
        if (error instanceof NotFoundError) continue;
        throw error;
      }
    }

    throw new NotFoundError('FallbackSource found no valid ConfigSource');
  }

  async readContents(): Promise<[string, FileType]> {
    const value = await this.readValue();

    return [JSON.stringify(value), FileType.JSON];
  }
}

export function filePathAssumedType(filePath: string): FileType {
  switch (extname(filePath).toLowerCase().slice(1)) {
    case 'yml':
    case 'yaml':
      return FileType.YAML;
    case 'toml':
      return FileType.TOML;
    case 'json':
      return FileType.JSON;
    case 'json5':
      return FileType.JSON5;
    default:
      throw new Error(
        `The file path "${filePath}" has an ambiguous file type, and a FileType could not be inferred`,
      );
  }
}

async function parseRawString(contents: string, fileType: FileType): Promise<Json> {
  switch (fileType) {
    case FileType.JSON:
      return JSON.parse(contents) as JsonObject;
    case FileType.YAML:
      return (parseYAML(contents) ?? {}) as JsonObject;
    case FileType.TOML:
      return parseTOML(contents) as JsonObject;
    case FileType.JSON5:
      return parseJSON5(contents) as JsonObject;
    default:
      throw new Error(`Unsupported FileType '${fileType as string}'`);
  }
}

async function guessFileType(contents: string): Promise<FileType> {
  try {
    await parseRawString(contents, FileType.JSON);
    return FileType.JSON;
  } catch {
    /* expected */
  }

  try {
    await parseRawString(contents, FileType.TOML);
    return FileType.TOML;
  } catch {
    /* expected */
  }

  try {
    await parseRawString(contents, FileType.JSON5);
    return FileType.JSON5;
  } catch {
    /* expected */
  }

  try {
    await parseRawString(contents, FileType.YAML);
    return FileType.YAML;
  } catch {
    /* expected */
  }

  throw new Error(`app-config was not in a parseable format`);
}

export function stringify(config: Json, fileType: FileType, minimal: boolean = false): string {
  switch (fileType) {
    case FileType.JSON: {
      return JSON.stringify(config, null, minimal ? 0 : 2);
    }
    case FileType.JSON5: {
      return stringifyJSON5(config, null, minimal ? 0 : 2);
    }
    case FileType.TOML: {
      return stringifyTOML(config as any);
    }
    case FileType.YAML:
    default: {
      return stringifyYAML(config);
    }
  }
}
