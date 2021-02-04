import { guessFileType, ConfigSource, FileType, NotFoundError, logger } from '@app-config/core';

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
