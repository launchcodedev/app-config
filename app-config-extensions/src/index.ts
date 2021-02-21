import { join, dirname, resolve, isAbsolute } from 'path';
import { forKey, validateOptions } from '@app-config/extension-utils';
import {
  ParsedValue,
  ParsedValueMetadata,
  ParsingExtension,
  AppConfigError,
  NotFoundError,
  FailedToSelectSubObject,
} from '@app-config/core';
import {
  currentEnvironment,
  defaultAliases,
  EnvironmentAliases,
  FileSource,
} from '@app-config/node';
import { logger } from '@app-config/logging';

/** Marks all values recursively as fromSecrets, so they do not trigger schema errors */
export function markAllValuesAsSecret(): ParsingExtension {
  return (value) => (parse) => parse(value, { fromSecrets: true });
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

/** Uses another file as overriding values, layering them on top of current file */
export function overrideDirective(): ParsingExtension {
  return fileReferenceDirective('$override', { shouldOverride: true });
}

/** Uses another file as a "base", and extends on top of it */
export function extendsDirective(): ParsingExtension {
  return fileReferenceDirective('$extends', { shouldMerge: true });
}

/** Lookup a property in the same file, and "copy" it */
export function extendsSelfDirective(): ParsingExtension {
  return forKey(
    '$extendsSelf',
    validateOptions(
      (SchemaBuilder) => SchemaBuilder.stringSchema(),
      (value) => async (parse, _, __, ___, root) => {
        // we temporarily use a ParsedValue literal so that we get the same property lookup semantics
        const selected = ParsedValue.literal(root).property(value.split('.'));

        if (selected === undefined) {
          throw new AppConfigError(`$extendsSelf selector was not found (${value})`);
        }

        if (selected.asObject() !== undefined) {
          return parse(selected.toJSON(), { shouldMerge: true });
        }

        return parse(selected.toJSON(), { shouldFlatten: true });
      },
    ),
  );
}

/** Looks up an environment-specific value ($env) */
export function envDirective(
  aliases: EnvironmentAliases = defaultAliases,
  environmentOverride?: string,
  environmentSourceNames?: string[] | string,
): ParsingExtension {
  const environment = environmentOverride ?? currentEnvironment(aliases, environmentSourceNames);
  const metadata = { shouldOverride: true };

  return forKey(
    '$env',
    validateOptions(
      (SchemaBuilder) => SchemaBuilder.emptySchema().addAdditionalProperties(),
      (value) => (parse) => {
        if (!environment) {
          if ('default' in value) {
            return parse(value.default, metadata);
          }

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
      },
    ),
  );
}

/** Provides the current timestamp using { $timestamp: true } */
export function timestampDirective(dateSource: () => Date = () => new Date()): ParsingExtension {
  return forKey(
    '$timestamp',
    validateOptions(
      (SchemaBuilder) =>
        SchemaBuilder.oneOf(
          SchemaBuilder.booleanSchema(),
          SchemaBuilder.emptySchema()
            .addString('day', {}, false)
            .addString('month', {}, false)
            .addString('year', {}, false)
            .addString('weekday', {}, false)
            .addString('locale', {}, false)
            .addString('timeZone', {}, false)
            .addString('timeZoneName', {}, false),
        ),
      (value) => (parse) => {
        let formatted: string;
        const date = dateSource();

        if (value === true) {
          formatted = date.toISOString();
        } else if (typeof value === 'object') {
          const { locale, ...options } = value;

          formatted = date.toLocaleDateString(locale, options);
        } else {
          throw new AppConfigError('$timestamp was provided an invalid option');
        }

        return parse(formatted, { shouldFlatten: true });
      },
    ),
  );
}

/** Substitues environment variables found in strings (similar to bash variable substitution) */
export function environmentVariableSubstitution(
  aliases: EnvironmentAliases = defaultAliases,
  environmentOverride?: string,
  environmentSourceNames?: string[] | string,
): ParsingExtension {
  const envType = environmentOverride ?? currentEnvironment(aliases, environmentSourceNames);

  return forKey(
    ['$substitute', '$subs'],
    validateOptions(
      (SchemaBuilder) =>
        SchemaBuilder.oneOf(
          SchemaBuilder.stringSchema(),
          SchemaBuilder.emptySchema().addString('$name').addString('$fallback', {}, false),
        ),
      (value) => (parse) => {
        if (typeof value === 'object') {
          const { $name: variableName, $fallback: fallback } = value;
          const resolvedValue = process.env[variableName];

          if (fallback !== undefined) {
            return parse(resolvedValue || fallback, { shouldFlatten: true });
          }

          if (!resolvedValue) {
            throw new AppConfigError(
              `$substitute could not find ${variableName} environment variable`,
            );
          }

          return parse(resolvedValue, { shouldFlatten: true });
        }

        return parse(performAllSubstitutions(value, envType), { shouldFlatten: true });
      },
    ),
  );
}

// common logic for $extends and $override
function fileReferenceDirective(keyName: string, meta: ParsedValueMetadata): ParsingExtension {
  return forKey(
    keyName,
    validateOptions(
      (SchemaBuilder) => {
        const reference = SchemaBuilder.oneOf(
          SchemaBuilder.stringSchema(),
          SchemaBuilder.emptySchema()
            .addString('path')
            .addBoolean('optional', {}, false)
            .addString('select', {}, false),
        );

        return SchemaBuilder.oneOf(reference, SchemaBuilder.arraySchema(reference));
      },
      (value) => async (parse, _, context, extensions) => {
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
              throw new FailedToSelectSubObject(
                `Failed to select ${subselector} in ${resolvedPath}`,
              );
            }

            return found;
          }

          return parsed;
        };

        let parsed: ParsedValue;

        if (typeof value === 'string') {
          parsed = await retrieveFile(value);
        } else if (Array.isArray(value)) {
          parsed = ParsedValue.literal({});

          for (const ext of value) {
            if (typeof ext === 'string') {
              parsed = ParsedValue.merge(parsed, await retrieveFile(ext));
            } else {
              const { path, optional, select } = ext;

              parsed = ParsedValue.merge(parsed, await retrieveFile(path, select, optional));
            }
          }
        } else {
          const { path, optional, select } = value;

          parsed = await retrieveFile(path, select, optional);
        }

        return parsed.assignMeta(meta);
      },
    ),
  );
}

function performAllSubstitutions(text: string, envType?: string): string {
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
        output = performAllSubstitutions(output.replace(fullMatch, fallback), envType);
      } else if (varName === 'APP_CONFIG_ENV') {
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
}
