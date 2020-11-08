import { join, dirname } from 'path';
import { isObject, Json, PromiseOrNot } from './common';
import { currentEnvironment, defaultAliases, EnvironmentAliases } from './environment';
import { ParsedValue, ParsedValueMetadata } from './parsed-value';
import { ConfigSource, FileSource } from './config-source';
import { decryptValue, DecryptedSymmetricKey } from './encryption';
import { AppConfigError, NotFoundError, FailedToSelectSubObject } from './errors';
import { logger } from './logging';

export const defaultExtensions = [
  envDirective(),
  extendsDirective(),
  overrideDirective(),
  encryptedDirective(),
  environmentVariableSubstitution(),
];

type TransformParentOptions = {
  /**
   * This option governs whether the returned value should be set as its parent (remove the key, set parent as child's value).
   *
   * It's usually in tandem with merge or override, which are the strategies to use when flattening.
   */
  flatten?: boolean;
  /**
   * When flattening, should the value be merged into the parent's existing values?
   */
  merge?: boolean;
  /**
   * When flattening, should the value replace parent's existing values?
   */
  override?: boolean;
  /**
   * Metadata to pass on to ParsedValues.
   */
  metadata?: ParsedValueMetadata;
};

export type FileParsingExtension = (
  key: string,
  value: Json,
) => false | FileParsingExtensionTransform;
export type FileParsingExtensionTransform = (
  context: ConfigSource,
  extensions: FileParsingExtension[],
) => PromiseOrNot<[Json | ParsedValue, TransformParentOptions]>;

/** Uses another file as a "base", and extends on top of it */
export function extendsDirective(): FileParsingExtension {
  return fileReferenceDirective('$extends', { flatten: true, merge: true });
}

/** Uses another file as overriding values, layering them on top of current file */
export function overrideDirective(): FileParsingExtension {
  return fileReferenceDirective('$override', { flatten: true, override: true });
}

/** Looks up an environment-specific value ($env) */
export function envDirective(aliases: EnvironmentAliases = defaultAliases): FileParsingExtension {
  const environment = currentEnvironment(aliases);

  return (key, obj) => {
    if (key !== '$env') return false;

    return () => {
      if (!isObject(obj))
        throw new AppConfigError('An $env directive was used with a non-object value');

      if (!environment) {
        if (obj.default) return [obj.default, { flatten: true, merge: true }];

        throw new AppConfigError(
          `An $env directive was used, but current environment (eg. NODE_ENV) is undefined`,
        );
      }

      for (const [envName, value] of Object.entries(obj)) {
        if (envName === environment || aliases[envName] === environment) {
          return [value, { flatten: true, merge: true }];
        }
      }

      if ('default' in obj) {
        return [obj.default, { flatten: true, merge: true }];
      }

      const found = Object.keys(obj).join(', ');

      throw new AppConfigError(
        `An $env directive was used, but none matched the current environment (wanted ${environment}, got ${found})`,
      );
    };
  };
}

/** Decrypts inline encrypted values */
export function encryptedDirective(symmetricKey?: DecryptedSymmetricKey): FileParsingExtension {
  return (_, value) => {
    if (typeof value !== 'string' || !value.startsWith('enc:')) return false;

    return async () => {
      const decrypted = await decryptValue(value, symmetricKey);

      return [decrypted, { metadata: { parsedFromEncryptedValue: true, fromSecrets: true } }];
    };
  };
}

/** Substitues environment variables found in strings (similar to bash variable substitution) */
export function environmentVariableSubstitution(
  aliases: EnvironmentAliases = defaultAliases,
): FileParsingExtension {
  const performAllSubstitutions = (text: string): string => {
    let output = text;

    // this regex matches:
    //   $FOO
    //   ${FOO}
    //   ${FOO:-fallback}
    //   ${FOO:-${FALLBACK}}
    //
    // var name is group 1 || 2
    // fallback value is group 3
    // https://regex101.com/r/6ZMmx7/3
    const envVar = /\$(?:([a-zA-Z_]\w+)|(?:{([a-zA-Z_]\w+)(?::- *(.*?) *)?}))/g;

    while (true) {
      const match = envVar.exec(output);
      if (!match) break;

      const fullMatch = match[0];
      const varName = match[1] || match[2];
      const fallback = match[3];

      if (varName) {
        const env = process.env[varName];

        if (env !== undefined) {
          output = output.replace(fullMatch, env);
        } else if (fallback !== undefined) {
          // we'll recurse again, so that ${FOO:-${FALLBACK}} -> ${FALLBACK} -> value
          output = performAllSubstitutions(output.replace(fullMatch, fallback));
        } else if (varName === 'APP_CONFIG_ENV') {
          const envType = currentEnvironment(aliases);

          if (!envType) {
            throw new AppConfigError(`Could not find environment variable ${varName}`);
          }

          // there's a special case for APP_CONFIG_ENV, which is always the envType
          output = output.replace(fullMatch, envType);
        } else {
          throw new AppConfigError(`Could not find environment variable ${varName}`);
        }
      }
    }

    logger.verbose(`Performed $substitute for "${text}" -> "${output}"`);

    return output;
  };

  return (key, value) => {
    if (key !== '$substitute' && key !== '$subs') return false;

    return () => {
      if (typeof value !== 'string') throw new AppConfigError('$substitute expects a string value');

      return [performAllSubstitutions(value), { flatten: true }];
    };
  };
}

// common logic for $extends and $override
function fileReferenceDirective(
  keyName: string,
  options: TransformParentOptions,
): FileParsingExtension {
  return (key, extend) => {
    if (key !== keyName) return false;

    return async (context, extensions) => {
      let filepath: string;
      let isOptional = false;
      let subselector: string | undefined;

      if (typeof extend === 'string') {
        filepath = extend;
      } else if (isObject(extend)) {
        const { path, optional, select } = extend;

        if (!path || typeof path !== 'string') {
          throw new AppConfigError(`Invalid ${keyName} filepath found`);
        }

        if (select !== undefined && typeof select !== 'string') {
          throw new AppConfigError(`Invalid ${keyName} select found`);
        }

        if (optional !== undefined && typeof optional !== 'boolean') {
          throw new AppConfigError(`Invalid ${keyName} optional found`);
        }

        filepath = path;
        isOptional = optional || false;
        subselector = select || undefined;
      } else {
        throw new AppConfigError(`${keyName} was provided an invalid option`);
      }

      if (context instanceof FileSource) {
        filepath = join(dirname(context.filePath), filepath);
      }

      logger.verbose(`Loading file for ${keyName}: ${filepath}`);

      const source = new FileSource(filepath);

      const parsed = await source.read(extensions).catch((error) => {
        if (error instanceof NotFoundError && isOptional) {
          return ParsedValue.literal({});
        }

        throw error;
      });

      if (subselector) {
        const found = parsed.property(subselector.split('.'));

        if (!found) {
          throw new FailedToSelectSubObject(`Failed to select ${subselector} in ${filepath}`);
        }

        return [found, options];
      }

      return [parsed, options];
    };
  };
}
