/** Any generic error that comes directly from this package */
export class AppConfigError extends Error {}

/** When a ConfigSource cannot be found */
export class NotFoundError extends AppConfigError {}

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
