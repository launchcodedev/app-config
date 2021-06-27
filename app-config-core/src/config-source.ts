import { extname } from 'path';
import { parse as parseTOML, stringify as stringifyTOML } from '@iarna/toml';
import { safeLoad as parseYAML, safeDump as stringifyYAML } from 'js-yaml';
import { parse as parseJSON5, stringify as stringifyJSON5 } from 'json5';
import { Json, JsonObject } from '@app-config/utils';
import { logger } from '@app-config/logging';
import { ParsedValue, ParsingContext, ParsingExtension } from './parsed-value';
import {
  AppConfigError,
  NotFoundError,
  ParsingError,
  BadFileType,
  FallbackExhaustedError,
} from './errors';

/**
 * File formats that app-config supports.
 */
export enum FileType {
  YAML = 'YAML',
  TOML = 'TOML',
  JSON = 'JSON',
  JSON5 = 'JSON5',

  /** @hidden Raw is only used for CLI output */
  RAW = 'RAW',
}

/** Base class for "sources", which are strategies to read configuration (eg. files, environment variables) */
export abstract class ConfigSource {
  public readonly filePath?: string;

  /** Only method that is *required* for all ConfigSources, which is built on in readValue, read, and readToJSON */
  protected abstract readContents(): Promise<[string, FileType]>;

  /** Parses contents of the source */
  async readValue(): Promise<Json> {
    const [contents, fileType] = await this.readContents();

    return parseRawString(contents, fileType);
  }

  /** Reads the contents of the source into a full ParsedValue (not the raw JSON, like readValue) */
  async read(extensions?: ParsingExtension[], context?: ParsingContext): Promise<ParsedValue> {
    const rawValue = await this.readValue();

    return ParsedValue.parse(rawValue, this, extensions, undefined, context);
  }

  /** Ergonomic helper for chaining `source.read(extensions).then(v => v.toJSON())` */
  async readToJSON(extensions?: ParsingExtension[], context?: ParsingContext): Promise<Json> {
    const parsed = await this.read(extensions, context);

    return parsed.toJSON();
  }
}

/** Read configuration from a literal JS object */
export class LiteralSource extends ConfigSource {
  constructor(private readonly value: Json) {
    super();
  }

  async readContents(): Promise<[string, FileType]> {
    return [JSON.stringify(this.value), FileType.JSON];
  }

  async readValue(): Promise<Json> {
    return this.value; // overriden just for performance
  }
}

/** Read configuration from many ConfigSources and merge them */
export class CombinedSource extends ConfigSource {
  constructor(public readonly sources: ConfigSource[]) {
    super();

    if (sources.length === 0) {
      throw new AppConfigError('CombinedSource requires at least one source');
    }
  }

  // overriden only because it's part of the class signature, normally would never be called
  async readContents(): Promise<[string, FileType]> {
    const value = await this.readValue();

    return [JSON.stringify(value), FileType.JSON];
  }

  // override because readContents uses it (which is backwards from super class)
  async readValue(): Promise<Json> {
    return this.readToJSON();
  }

  // override so that ParsedValue is directly from the originating ConfigSource
  async read(extensions?: ParsingExtension[], context?: ParsingContext): Promise<ParsedValue> {
    const values = await Promise.all(
      this.sources.map((source) => source.read(extensions, { ...context })),
    );

    const merged = values.reduce<ParsedValue | undefined>((acc, parsed) => {
      if (!acc) return parsed;
      return ParsedValue.merge(acc, parsed);
    }, undefined);

    if (!merged) throw new AppConfigError('CombinedSource ended up merging into a falsey value');

    Object.assign(merged, { sources: [this] });

    return merged;
  }
}

/** Read configuration from the first ConfigSource that doesn't fail */
export class FallbackSource extends ConfigSource {
  constructor(public readonly sources: ConfigSource[]) {
    super();

    if (sources.length === 0) {
      throw new AppConfigError('FallbackSource requires at least one source');
    }
  }

  // overriden only because it's part of the class signature, normally would never be called
  async readContents(): Promise<[string, FileType]> {
    const value = await this.readValue();

    return [JSON.stringify(value), FileType.JSON];
  }

  // override because readContents uses it (which is backwards from super class)
  async readValue(): Promise<Json> {
    const errors: NotFoundError[] = [];

    // take the first value that comes back without an error
    for (const source of this.sources) {
      try {
        const value = await source.readValue();
        logger.verbose(`FallbackSource found successful source`);

        return value;
      } catch (error) {
        if (source.filePath) {
          // special case for ConfigSource with `filePath`, only accept a NotFoundError for it's filePath
          if (NotFoundError.isNotFoundError(error, source.filePath)) {
            errors.push(error);
            continue;
          }
        } else if (NotFoundError.isNotFoundError(error)) {
          errors.push(error);
          continue;
        }

        throw error;
      }
    }

    throw new FallbackExhaustedError('FallbackSource found no valid ConfigSource', errors);
  }

  // override so that ParsedValue is directly from the originating ConfigSource
  async read(extensions?: ParsingExtension[], context?: ParsingContext): Promise<ParsedValue> {
    const errors: NotFoundError[] = [];

    // take the first value that comes back without an error
    for (const source of this.sources) {
      try {
        const value = await source.read(extensions, context);
        logger.verbose(`FallbackSource found successful source`);

        return value;
      } catch (error) {
        if (source.filePath) {
          // special case for ConfigSource with `filePath`, only accept a NotFoundError for it's filePath
          if (NotFoundError.isNotFoundError(error, source.filePath)) {
            errors.push(error);
            continue;
          }
        } else if (NotFoundError.isNotFoundError(error)) {
          errors.push(error);
          continue;
        }

        throw error;
      }
    }

    throw new FallbackExhaustedError('FallbackSource found no valid ConfigSource', errors);
  }
}

/**
 * Converts a JSON object to a string, using specified file type.
 */
export function stringify(config: Json, fileType: FileType, minimal: boolean = false): string {
  switch (fileType) {
    case FileType.JSON:
      return JSON.stringify(config, null, minimal ? 0 : 2);
    case FileType.JSON5:
      return stringifyJSON5(config, null, minimal ? 0 : 2);
    case FileType.TOML:
      return stringifyTOML(config as any);
    case FileType.YAML:
      return stringifyYAML(config);
    case FileType.RAW: {
      if (typeof config === 'string') return config;
      if (typeof config === 'number') return `${config}`;
      if (typeof config === 'boolean') return config ? 'true' : 'false';
      throw new BadFileType(`Stringifying "raw" only works with primitive values`);
    }

    default:
      throw new BadFileType(`Unsupported FileType '${fileType as string}'`);
  }
}

/**
 * Returns which file type to use, based on the file extension.
 */
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
      throw new BadFileType(
        `The file path "${filePath}" has an ambiguous file type, and a FileType could not be inferred`,
      );
  }
}

/**
 * Parses string based on a file format.
 */
export async function parseRawString(contents: string, fileType: FileType): Promise<Json> {
  switch (fileType) {
    case FileType.JSON:
      return JSON.parse(contents) as JsonObject;
    case FileType.YAML:
      return (parseYAML(contents) ?? {}) as JsonObject;
    case FileType.TOML:
      return parseTOML(contents) as JsonObject;
    case FileType.JSON5:
      return parseJSON5(contents);
    default:
      throw new BadFileType(`Unsupported FileType '${fileType as string}'`);
  }
}

/**
 * Try to parse string as different file formats, returning the first that worked.
 */
export async function guessFileType(contents: string): Promise<FileType> {
  for (const tryType of [FileType.JSON, FileType.TOML, FileType.JSON5, FileType.YAML]) {
    try {
      await parseRawString(contents, tryType);

      return tryType;
    } catch {
      // parsing errors are expected
    }
  }

  throw new ParsingError(`The provided configuration was not in a detectable/parseable format`);
}
