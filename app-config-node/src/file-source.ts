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
import {
  aliasesFor,
  currentEnvFromContext,
  defaultEnvOptions,
  EnvironmentOptions,
} from './environment';

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
        throw new NotFoundError(`File ${this.filePath} not found`, this.filePath);
      }

      throw err;
    }
  }
}

/** Read configuration from a file, found via "glob-like" search (any file format, with support for environment specific files) */
export class FlexibleFileSource extends ConfigSource {
  public readonly filePath: string;
  private readonly fileExtensions: string[];
  private readonly environmentOptions: EnvironmentOptions;

  constructor(
    filePath: string,
    fileExtensions?: string[],
    environmentOptions?: EnvironmentOptions,
  ) {
    super();

    this.filePath = filePath;
    this.fileExtensions = fileExtensions ?? ['yml', 'yaml', 'toml', 'json', 'json5'];
    this.environmentOptions = environmentOptions ?? defaultEnvOptions;
  }

  // share 'resolveSource' so that read() returns a ParsedValue pointed to the FileSource, not FlexibleFileSource
  private async resolveSource(context?: ParsingContext): Promise<FileSource> {
    const environment = currentEnvFromContext(context ?? {}, this.environmentOptions);
    const aliasesForCurrentEnv = environment
      ? aliasesFor(environment, this.environmentOptions.aliases)
      : [];

    const filesToTry = [];

    for (const ext of this.fileExtensions) {
      if (environment) filesToTry.push(`${this.filePath}.${environment}.${ext}`);

      for (const alias of aliasesForCurrentEnv) {
        filesToTry.push(`${this.filePath}.${alias}.${ext}`);
      }
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
      this.filePath,
    );
  }

  async readContents(): Promise<[string, FileType]> {
    return this.resolveSource().then((source) => source.readContents());
  }

  async read(extensions?: ParsingExtension[], context?: ParsingContext): Promise<ParsedValue> {
    const source = await this.resolveSource(context);

    return source.read(extensions, {
      ...context,
      environmentOptions: this.environmentOptions,
    });
  }
}

export function resolveFilepath(source: ConfigSource, filepath: string) {
  let resolvedPath = filepath;

  // resolve filepaths that are relative to the current FileSource
  if (!isAbsolute(filepath) && source instanceof FileSource) {
    resolvedPath = join(dirname(source.filePath), filepath);

    if (resolve(source.filePath) === resolvedPath) {
      throw new AppConfigError(`An extension tried to resolve to it's own file (${resolvedPath}).`);
    }
  }

  return resolvedPath;
}
