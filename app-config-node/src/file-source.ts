import { isAbsolute, join, dirname, resolve } from 'path';
import { readFile, pathExists } from 'fs-extra';
import {
  filePathAssumedType,
  ConfigSource,
  FileType,
  ParsedValue,
  ParsingExtension,
  AppConfigError,
  NotFoundError,
  ParsingContext,
} from '@app-config/core';
import { logger } from '@app-config/logging';
import { currentEnvironment, defaultAliases, EnvironmentAliases } from './environment';

/** Read configuration from a single file */
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
      logger.verbose(`FileSource read ${this.filePath}`);

      return [content.toString('utf-8'), this.fileType];
    } catch (err: unknown) {
      if (err && typeof err === 'object' && (err as { code?: string | number }).code === 'ENOENT') {
        throw new NotFoundError(`File ${this.filePath} not found`);
      }

      throw err;
    }
  }
}

/** Read configuration from a file, found via "glob-like" search (any file format, with support for environment specific files) */
export class FlexibleFileSource extends ConfigSource {
  constructor(
    private readonly filePath: string,
    private readonly environmentOverride?: string,
    private readonly environmentAliases: EnvironmentAliases = defaultAliases,
    private readonly environmentSourceNames?: string[] | string,
    private readonly fileExtensions: string[] = ['yml', 'yaml', 'toml', 'json', 'json5'],
  ) {
    super();
  }

  // share 'resolveSource' so that read() returns a ParsedValue pointed to the FileSource, not FlexibleFileSource
  private async resolveSource(): Promise<FileSource> {
    const aliases = this.environmentAliases;
    const environment =
      this.environmentOverride ?? currentEnvironment(aliases, this.environmentSourceNames);
    const environmentAlias = Object.entries(aliases).find(([, v]) => v === environment)?.[0];

    const filesToTry = [];

    for (const ext of this.fileExtensions) {
      if (environment) filesToTry.push(`${this.filePath}.${environment}.${ext}`);
      if (environmentAlias) filesToTry.push(`${this.filePath}.${environmentAlias}.${ext}`);
    }

    // try these after trying environments, which take precedent
    for (const ext of this.fileExtensions) {
      filesToTry.push(`${this.filePath}.${ext}`);
    }

    logger.verbose(`FlexibleFileSource is trying to find [${filesToTry.join(', ')}]`);

    for (const filepath of filesToTry) {
      if (await pathExists(filepath)) {
        logger.verbose(`FlexibleFileSource found successful match at ${filepath}`);

        return new FileSource(filepath);
      }
    }

    throw new NotFoundError(
      `FlexibleFileSource could not find file with ${this.filePath}.{yml|yaml|toml|json|json5}`,
    );
  }

  async readContents(): Promise<[string, FileType]> {
    return this.resolveSource().then((source) => source.readContents());
  }

  async read(extensions?: ParsingExtension[], context?: ParsingContext): Promise<ParsedValue> {
    const source = await this.resolveSource();

    return source.read(extensions, {
      environmentOverride: this.environmentOverride,
      environmentAliases: this.environmentAliases,
      environmentSourceNames: this.environmentSourceNames,
      ...context,
    });
  }
}

export function resolveFilepath(context: ConfigSource, filepath: string) {
  let resolvedPath = filepath;

  // resolve filepaths that are relative to the current FileSource
  if (!isAbsolute(filepath) && context instanceof FileSource) {
    resolvedPath = join(dirname(context.filePath), filepath);

    if (resolve(context.filePath) === resolvedPath) {
      throw new AppConfigError(`An extension tried to resolve to it's own file (${resolvedPath}).`);
    }
  }

  return resolvedPath;
}
