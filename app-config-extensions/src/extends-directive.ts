import type { ParsingExtension } from '@app-config/core';
import {
  named,
  forKey,
  validateOptions,
  validationFunction,
  ValidationFunction,
} from '@app-config/extension-utils';
import {
  ParsedValue,
  ParsedValueMetadata,
  AppConfigError,
  NotFoundError,
  FailedToSelectSubObject,
} from '@app-config/core';
import { resolveFilepath, FileSource, environmentOptionsFromContext } from '@app-config/node';
import { logger } from '@app-config/logging';

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
            .addString('select', {}, false)
            .addString('env', {}, false),
        );

        return SchemaBuilder.oneOf(reference, SchemaBuilder.arraySchema(reference));
      },
      (value, _, __, context) => async (_, __, source, extensions) => {
        const retrieveFile = async (
          filepath: string,
          subselector?: string,
          isOptional = false,
          env?: string,
        ) => {
          const resolvedPath = resolveFilepath(source, filepath);

          logger.verbose(`Loading file for ${keyName}: ${resolvedPath}`);

          const resolvedSource = new FileSource(resolvedPath);

          const environmentOptions = {
            ...environmentOptionsFromContext(context),
            override: env,
          };

          const parsed = await resolvedSource
            .read(extensions, {
              ...context,
              environmentOptions,
            })
            .catch((error) => {
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
              const { path, optional, select, env } = ext;

              parsed = ParsedValue.merge(parsed, await retrieveFile(path, select, optional, env));
            }
          }
        } else {
          const { path, optional, select, env } = value;

          parsed = await retrieveFile(path, select, optional, env);
        }

        return parsed.assignMeta(meta);
      },
    ),
  );
}

/** Uses another file as overriding values, layering them on top of current file */
export function overrideDirective(): ParsingExtension {
  return named('$override', fileReferenceDirective('$override', { shouldOverride: true }));
}

/** Uses another file as a "base", and extends on top of it */
export function extendsDirective(): ParsingExtension {
  return named('$extends', fileReferenceDirective('$extends', { shouldMerge: true }));
}

/** Lookup a property in the same file, and "copy" it */
export function extendsSelfDirective(): ParsingExtension {
  const validate: ValidationFunction<string> = validationFunction(
    ({ oneOf, stringSchema, emptySchema }) =>
      oneOf(stringSchema(), emptySchema().addString('select').addString('env', {}, false)),
  );

  return named(
    '$extendsSelf',
    forKey('$extendsSelf', (input, key, parentKeys, ctx) => async (parse, _, __, ___, root) => {
      let select: string;
      let env: string | undefined;

      const value = (await parse(input)).toJSON();

      validate(value, [...parentKeys, key]);

      if (typeof value === 'string') {
        select = value;
      } else {
        ({ select, env } = value);
      }

      const environmentOptions = {
        ...environmentOptionsFromContext(ctx),
        override: env,
      };

      // we temporarily use a ParsedValue literal so that we get the same property lookup semantics
      const selected = ParsedValue.literal(root).property(select.split('.'));

      if (selected === undefined) {
        throw new AppConfigError(`$extendsSelf selector was not found (${select})`);
      }

      if (selected.asObject() !== undefined) {
        return parse(selected.toJSON(), { shouldMerge: true }, undefined, undefined, {
          environmentOptions,
        });
      }

      return parse(selected.toJSON(), { shouldFlatten: true }, undefined, undefined, {
        environmentOptions,
      });
    }),
  );
}
