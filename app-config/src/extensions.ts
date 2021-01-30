import { join, dirname, extname, resolve, isAbsolute } from 'path';
import { pathExists } from 'fs-extra';
import simpleGit from 'simple-git';
import {
  isObject,
  Json,
  currentEnvironment,
  defaultAliases,
  EnvironmentAliases,
  ParsedValue,
  ParsedValueMetadata,
  ParsingExtension,
  Root,
  FileSource,
  AppConfigError,
  NotFoundError,
  FailedToSelectSubObject,
  logger,
} from '@app-config/core';

import { decryptValue, DecryptedSymmetricKey } from './encryption';

/** ParsingExtensions that are used by default in loadConfig for reading files */
export function defaultExtensions(
  aliases: EnvironmentAliases = defaultAliases,
  environmentOverride?: string,
  symmetricKey?: DecryptedSymmetricKey,
  environmentSourceNames?: string[] | string,
): ParsingExtension[] {
  return [
    v1Compat(),
    envDirective(aliases, environmentOverride, environmentSourceNames),
    extendsDirective(),
    extendsSelfDirective(),
    overrideDirective(),
    encryptedDirective(symmetricKey),
    timestampDirective(),
    unescape$Directives(),
    environmentVariableSubstitution(aliases, environmentOverride, environmentSourceNames),
    gitRefDirectives(),
  ];
}

/** ParsingExtensions that are used by default in loadConfig for APP_CONFIG variable */
export function defaultEnvExtensions(): ParsingExtension[] {
  return [unescape$Directives(), markAllValuesAsSecret()];
}

/** Marks all values recursively as fromSecrets, so they do not trigger schema errors */
export function markAllValuesAsSecret(): ParsingExtension {
  return (value) => (parse) => parse(value, { fromSecrets: true });
}

/** Uses another file as a "base", and extends on top of it */
export function extendsDirective(): ParsingExtension {
  return fileReferenceDirective('$extends', { shouldMerge: true });
}

/** Uses another file as overriding values, layering them on top of current file */
export function overrideDirective(): ParsingExtension {
  return fileReferenceDirective('$override', { shouldOverride: true });
}

/** Lookup a property in the same file, and "copy" it */
export function extendsSelfDirective(): ParsingExtension {
  return (value, [_, key]) => {
    if (key !== '$extendsSelf') return false;

    return async (parse, _, __, ___, root) => {
      const selector = (await parse(value)).toJSON();

      if (typeof selector !== 'string') {
        throw new AppConfigError(`$extendsSelf was provided a non-string value`);
      }

      // we temporarily use a ParsedValue literal so that we get the same property lookup semantics
      const selected = ParsedValue.literal(root).property(selector.split('.'));

      if (selected === undefined) {
        throw new AppConfigError(`$extendsSelf selector was not found (${selector})`);
      }

      if (selected.asObject() !== undefined) {
        return parse(selected.toJSON(), { shouldMerge: true });
      }

      return parse(selected.toJSON(), { shouldFlatten: true });
    };
  };
}

/** Looks up an environment-specific value ($env) */
export function envDirective(
  aliases: EnvironmentAliases = defaultAliases,
  environmentOverride?: string,
  environmentSourceNames?: string[] | string,
): ParsingExtension {
  const environment = environmentOverride ?? currentEnvironment(aliases, environmentSourceNames);
  const metadata = { shouldOverride: true };

  return (value, [_, key]) => {
    if (key === '$env') {
      return (parse) => {
        if (!isObject(value)) {
          throw new AppConfigError('An $env directive was used with a non-object value');
        }

        if (!environment) {
          if (value.default) return parse(value.default, metadata);

          throw new AppConfigError(
            `An $env directive was used, but current environment (eg. NODE_ENV) is undefined`,
          );
        }

        for (const [envName, envValue] of Object.entries(value)) {
          if (envName === environment || aliases[envName] === environment) {
            return parse(envValue, metadata);
          }
        }

        if ('default' in value) {
          return parse(value.default, metadata);
        }

        const found = Object.keys(value).join(', ');

        throw new AppConfigError(
          `An $env directive was used, but none matched the current environment (wanted ${environment}, saw [${found}])`,
        );
      };
    }

    return false;
  };
}

/** Decrypts inline encrypted values */
export function encryptedDirective(symmetricKey?: DecryptedSymmetricKey): ParsingExtension {
  return (value) => {
    if (typeof value === 'string' && value.startsWith('enc:')) {
      return async (parse) => {
        const decrypted = await decryptValue(value, symmetricKey);

        return parse(decrypted, { fromSecrets: true, parsedFromEncryptedValue: true });
      };
    }

    return false;
  };
}

/** Provides the current timestamp using { $timestamp: true } */
export function timestampDirective(dateSource: () => Date = () => new Date()): ParsingExtension {
  return (value, [_, key]) => {
    if (key === '$timestamp') {
      return async (parse) => {
        let formatted: string;
        const date = dateSource();

        if (value === true) {
          formatted = date.toISOString();
        } else if (value && typeof value === 'object' && !Array.isArray(value)) {
          const { locale, ...options } = value;

          if (typeof locale !== 'string') {
            throw new AppConfigError('$timestamp was provided a non-string locale');
          }

          formatted = date.toLocaleDateString(locale, options);
        } else {
          throw new AppConfigError('$timestamp was provided an invalid option');
        }

        return parse(formatted, { shouldFlatten: true });
      };
    }

    return false;
  };
}

/** When a key $$foo is seen, change it to be $foo and mark with meta property fromEscapedDirective */
export function unescape$Directives(): ParsingExtension {
  return (value, [_, key]) => {
    if (typeof key === 'string' && key.startsWith('$$')) {
      return async (parse) => {
        return parse(value, { rewriteKey: key.slice(1), fromEscapedDirective: true });
      };
    }

    return false;
  };
}

/** Substitues environment variables found in strings (similar to bash variable substitution) */
export function environmentVariableSubstitution(
  aliases: EnvironmentAliases = defaultAliases,
  environmentOverride?: string,
  environmentSourceNames?: string[] | string,
): ParsingExtension {
  const performAllSubstitutions = (text: string): string => {
    let output = text;

    /* eslint-disable-next-line no-constant-condition */
    while (true) {
      // this regex matches:
      //   $FOO
      //   ${FOO}
      //   ${FOO:-fallback}
      //   ${FOO:-${FALLBACK}}
      //
      // var name is group 1 || 2
      // fallback value is group 3
      // https://regex101.com/r/6ZMmx7/3
      const match = /\$(?:([a-zA-Z_]\w+)|(?:{([a-zA-Z_]\w+)(?::- *(.*?) *)?}))/g.exec(output);

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
          const envType =
            environmentOverride ?? currentEnvironment(aliases, environmentSourceNames);

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

  return (value, [_, key]) => {
    if (key === '$subsitute') logger.warn('Noticed a typo! Key of $subsitute was found.');

    if (key === '$substitute' || key === '$subs') {
      return (parse) => {
        if (typeof value !== 'string')
          throw new AppConfigError('$substitute expects a string value');

        return parse(performAllSubstitutions(value), { shouldFlatten: true });
      };
    }

    return false;
  };
}

/** Access to the git branch and commit ref */
export function gitRefDirectives(getStatus: typeof gitStatus = gitStatus): ParsingExtension {
  return (value, [_, key]) => {
    if (key === '$git') {
      return async (parse) => {
        if (typeof value !== 'string') {
          throw new AppConfigError('$git directive should be passed a string');
        }

        switch (value) {
          case 'commit':
            return getStatus().then(({ commitRef }) => parse(commitRef, { shouldFlatten: true }));

          case 'commitShort':
            return getStatus().then(({ commitRef }) =>
              parse(commitRef.slice(0, 7), { shouldFlatten: true }),
            );

          case 'branch':
            return getStatus().then(({ branchName }) => {
              if (!branchName) {
                throw new AppConfigError(
                  'The $git directive tried to retrieve branchname, but it appears no branch is checked out',
                );
              }

              return parse(branchName, { shouldFlatten: true });
            });

          default:
            throw new AppConfigError('$git directive was not passed a valid option');
        }
      };
    }

    return false;
  };
}

/** V1 app-config compatibility */
export function v1Compat(): ParsingExtension {
  return (value, [_, key], context) => {
    // only apply in top-level app-config property
    if (context[context.length - 1]?.[0] !== Root) {
      return false;
    }

    if (key === 'app-config' && isObject(value)) {
      return async (parse, _, ctx) => {
        if (ctx instanceof FileSource) {
          logger.warn(
            `Using V1 compatibility layer for special 'app-config' property in ${ctx.filePath}! This functionality is deprecated and may be removed in the future.`,
          );
        } else {
          logger.warn(
            `Using V1 compatibility layer for special 'app-config' property! This functionality is deprecated and may be removed in the future.`,
          );
        }

        const resolveAmbiguousFilename = async (filepath: string) => {
          let resolvedPath = filepath;

          // resolve filepaths that are relative to the current FileSource
          if (ctx instanceof FileSource) {
            resolvedPath = join(dirname(ctx.filePath), filepath);
          }

          switch (extname(resolvedPath)) {
            case '.yml':
            case '.yaml':
            case '.json':
            case '.json5':
            case '.toml':
              return resolvedPath;
            default: {
              if (await pathExists(`${resolvedPath}.yml`)) return `${resolvedPath}.yml`;
              if (await pathExists(`${resolvedPath}.yaml`)) return `${resolvedPath}.yaml`;
              if (await pathExists(`${resolvedPath}.json`)) return `${resolvedPath}.json`;
              if (await pathExists(`${resolvedPath}.json5`)) return `${resolvedPath}.json5`;
              if (await pathExists(`${resolvedPath}.toml`)) return `${resolvedPath}.toml`;

              return resolvedPath;
            }
          }
        };

        // TODO: multiple properties defined

        if ('extends' in value) {
          return parse(
            { $extends: await resolveAmbiguousFilename(value.extends as string) },
            { shouldMerge: true },
          );
        }

        if ('extendsOptional' in value) {
          return parse(
            {
              $extends: {
                path: await resolveAmbiguousFilename(value.extendsOptional as string),
                optional: true,
              },
            },
            { shouldMerge: true },
          );
        }

        if ('override' in value) {
          return parse(
            { $override: await resolveAmbiguousFilename(value.override as string) },
            { shouldOverride: true },
          );
        }

        if ('overrideOptional' in value) {
          return parse(
            {
              $override: {
                path: await resolveAmbiguousFilename(value.overrideOptional as string),
                optional: true,
              },
            },
            { shouldOverride: true },
          );
        }

        return parse(value);
      };
    }

    return false;
  };
}

// common logic for $extends and $override
function fileReferenceDirective(keyName: string, meta: ParsedValueMetadata): ParsingExtension {
  return (value, [_, key]) => {
    if (key !== keyName) return false;

    return async (parse, _, context, extensions) => {
      const retrieveFile = async (filepath: string, subselector?: string, isOptional = false) => {
        let resolvedPath = filepath;

        // resolve filepaths that are relative to the current FileSource
        if (!isAbsolute(filepath) && context instanceof FileSource) {
          resolvedPath = join(dirname(context.filePath), filepath);

          if (resolve(context.filePath) === resolvedPath) {
            throw new AppConfigError(
              `A ${keyName} directive resolved to it's own file (${resolvedPath}). Please use $extendsSelf instead.`,
            );
          }
        }

        logger.verbose(`Loading file for ${keyName}: ${resolvedPath}`);

        const source = new FileSource(resolvedPath);

        const parsed = await source.read(extensions).catch((error) => {
          if (error instanceof NotFoundError && isOptional) {
            return ParsedValue.literal({});
          }

          throw error;
        });

        if (subselector) {
          const found = parsed.property(subselector.split('.'));

          if (!found) {
            throw new FailedToSelectSubObject(`Failed to select ${subselector} in ${resolvedPath}`);
          }

          return found;
        }

        return parsed;
      };

      const forOptions = async (options: Json) => {
        const parsed = (await parse(options)).toJSON();

        if (typeof parsed === 'string') {
          return retrieveFile(parsed);
        }

        if (!isObject(parsed)) {
          throw new AppConfigError(`${keyName} was provided an invalid option`);
        }

        const { path, optional, select } = parsed;

        if (!path || typeof path !== 'string') {
          throw new AppConfigError(`Invalid ${keyName} filepath found`);
        }

        if (select !== undefined && typeof select !== 'string') {
          throw new AppConfigError(`Invalid ${keyName} select found`);
        }

        if (optional !== undefined && typeof optional !== 'boolean') {
          throw new AppConfigError(`Invalid ${keyName} optional found`);
        }

        return retrieveFile(path, select, optional);
      };

      let parsed: ParsedValue;

      if (Array.isArray(value)) {
        parsed = ParsedValue.literal({});

        for (const ext of value) {
          parsed = ParsedValue.merge(parsed, await forOptions(ext));
        }
      } else {
        parsed = await forOptions(value);
      }

      return parsed.assignMeta(meta);
    };
  };
}

interface GitStatus {
  commitRef: string;
  branchName?: string;
}

async function gitStatus(): Promise<GitStatus> {
  const git = simpleGit({});
  const rev = await git.revparse(['HEAD']);
  const branch = await git.revparse(['--abbrev-ref', 'HEAD']);

  return {
    commitRef: rev,
    branchName: branch,
  };
}
