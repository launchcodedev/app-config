import { resolve } from 'path';
import { readFile, pathExists } from 'fs-extra';
import {
  ConfigSource,
  FileType,
  NotFoundError,
  ParsedValue,
  ParsingExtension,
  filePathAssumedType,
  guessFileType,
  logger,
} from '@app-config/core';
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
    private readonly fileExtensions: string[] = ['yml', 'yaml', 'toml', 'json', 'json5'],
  ) {
    super();
  }

  // share 'resolveSource' so that read() returns a ParsedValue pointed to the FileSource, not FlexibleFileSource
  private async resolveSource(): Promise<FileSource> {
    const aliases = this.environmentAliases;
    const environment = this.environmentOverride ?? currentEnvironment(aliases);
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

  async read(extensions?: ParsingExtension[]): Promise<ParsedValue> {
    const source = await this.resolveSource();

    return source.read(extensions);
  }
}

/** Read configuration from an environment variable */
export class EnvironmentSource extends ConfigSource {
  constructor(public readonly variableName: string) {
    super();
  }

  async readContents(): Promise<[string, FileType]> {
    const value = process.env[this.variableName];

    if (!value) {
      throw new NotFoundError(`Could not read the environment variable '${this.variableName}'`);
    }

    const inferredFileType = await guessFileType(value);

    logger.verbose(
      `EnvironmentSource guessed that ${this.variableName} is ${inferredFileType} FileType`,
    );

    return [value, inferredFileType];
  }
}
