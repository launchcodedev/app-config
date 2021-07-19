/** Any generic error that comes directly from this package */
export class AppConfigError extends Error {}

/** An error that can be recovered using $try */
export class Fallbackable extends AppConfigError {}

/** When a ConfigSource cannot be found */
export class NotFoundError extends Fallbackable {
  constructor(message?: string, public readonly filepath?: string) {
    super(message);
  }

  static isNotFoundError(err: Error | unknown, filepath?: string): err is NotFoundError {
    if (err instanceof NotFoundError) {
      if (filepath) {
        return err.filepath === filepath;
      }

      return true;
    }

    return false;
  }
}

export class EnvironmentVariableNotFoundError extends NotFoundError {
  constructor(message?: string, public readonly environmentVariable?: string) {
    super(message);
  }
}

export class FallbackExhaustedError extends NotFoundError {
  constructor(message: string, public readonly errors: NotFoundError[]) {
    super(message);
  }
}

/** Could not parse a string from a config source */
export class ParsingError extends AppConfigError {}

/** Unsupported file type or extension */
export class BadFileType extends AppConfigError {}

/** Configuration was not an object, when it was expected to be */
export class WasNotObject extends AppConfigError {}

/** Error during schema validation */
export class ValidationError extends AppConfigError {}

/** For encrypting and decrypting secrets, stdin is required for prompts sometimes */
export class SecretsRequireTTYError extends AppConfigError {}

/** No input was received for a prompt or reading from stdin */
export class EmptyStdinOrPromptResponse extends AppConfigError {}

/** Encryption key was invalid in some way */
export class InvalidEncryptionKey extends AppConfigError {}

/** An error in encoding or decoding (encryption logic) */
export class EncryptionEncoding extends AppConfigError {}

/** Could not select a sub-object using a JSON pointer */
export class FailedToSelectSubObject extends AppConfigError {}

/** Found a key starting with $ in config object */
export class ReservedKeyError extends AppConfigError {}
