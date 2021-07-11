import type { ParsingExtension } from '@app-config/core';
import { named, forKey, validationFunction, ValidationFunction } from '@app-config/extension-utils';
import { AppConfigError, InObject } from '@app-config/core';
import {
  asEnvOptions,
  currentEnvFromContext,
  defaultAliases,
  EnvironmentAliases,
} from '@app-config/node';

/** Substitutes environment variables */
export function envVarDirective(
  aliases: EnvironmentAliases = defaultAliases,
  environmentOverride?: string,
  environmentSourceNames?: string[] | string,
): ParsingExtension {
  return named(
    '$envVar',
    forKey('$envVar', (value, key, parentKeys, context) => async (parse) => {
      let name: string;

      if (typeof value === 'string') {
        name = value;
      } else {
        validateObject(value, [...parentKeys, key]);
        if (Array.isArray(value)) throw new AppConfigError('$envVar was given an array');

        const resolved = (await parse(value.name)).toJSON();
        validateString(resolved, [...parentKeys, key, [InObject, 'name']]);

        name = resolved;
      }

      const parseValue = (strValue: string | null) => {
        if (strValue === null) {
          return parse(null, { shouldFlatten: true });
        }

        return parse(strValue, { shouldFlatten: true });
      };

      let resolvedValue = process.env[name];

      if (name === 'APP_CONFIG_ENV') {
        const environment = currentEnvFromContext(
          context,
          asEnvOptions(environmentOverride, aliases, environmentSourceNames),
        );

        resolvedValue = environment;
      }

      if (resolvedValue) {
        return parseValue(resolvedValue);
      }

      if (typeof value === 'object') {
        if (value.fallback !== undefined) {
          const fallback = (await parse(value.fallback)).toJSON();
          const allowNull = (await parse(value.allowNull)).toJSON();

          if (allowNull) {
            validateStringOrNull(fallback, [...parentKeys, key, [InObject, 'fallback']]);
          } else {
            validateString(fallback, [...parentKeys, key, [InObject, 'fallback']]);
          }

          return parseValue(fallback);
        }

        const allowMissing = (await parse(value.allowMissing)).toJSON();

        if (allowMissing) {
          return parseValue(null);
        }
      }

      throw new AppConfigError(`$envVar could not find ${name} environment variable`);
    }),
  );
}

const validateObject: ValidationFunction<Record<string, any>> = validationFunction(
  ({ emptySchema }) => emptySchema().addAdditionalProperties(),
);

const validateString: ValidationFunction<string> = validationFunction(({ stringSchema }) =>
  stringSchema(),
);

const validateStringOrNull: ValidationFunction<string | null> = validationFunction(
  ({ fromJsonSchema }) => fromJsonSchema({ type: ['null', 'string'] } as const),
);
