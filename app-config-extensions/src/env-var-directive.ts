import type { ParsingExtension } from '@app-config/core';
import { named, forKey, validationFunction, ValidationFunction } from '@app-config/extension-utils';
import { AppConfigError, InObject } from '@app-config/core';
import {
  asEnvOptions,
  currentEnvFromContext,
  defaultAliases,
  EnvironmentAliases,
} from '@app-config/node';
import { logger } from '@app-config/logging';

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
      let parseInt = false;
      let parseFloat = false;
      let parseBool = false;

      if (typeof value === 'string') {
        name = value;
      } else {
        validateObject(value, [...parentKeys, key]);
        if (Array.isArray(value)) throw new AppConfigError('$envVar was given an array');

        const resolved = (await parse(value.name)).toJSON();
        validateString(resolved, [...parentKeys, key, [InObject, 'name']]);

        parseInt = !!(await parse(value.parseInt)).toJSON();
        parseFloat = !!(await parse(value.parseFloat)).toJSON();
        parseBool = !!(await parse(value.parseBool)).toJSON();
        name = resolved;

        if (parseInt) {
          logger.warn(
            `Detected use of deprecated of 'parseInt' option in $envVar - use $parseInt directive instead`,
          );
        }

        if (parseFloat) {
          logger.warn(
            `Detected use of deprecated of 'parseFloat' option in $envVar - use $parseFloat directive instead`,
          );
        }

        if (parseBool) {
          logger.warn(
            `Detected use of deprecated of 'parseBool' option in $envVar - use $parseBool directive instead`,
          );
        }
      }

      const parseValue = (strValue: string | null) => {
        if (parseBool) {
          const parsed =
            strValue !== null && (strValue.toLowerCase() === 'true' || strValue === '1');

          return parse(parsed, { shouldFlatten: true });
        }

        if (strValue === null) {
          return parse(null, { shouldFlatten: true });
        }

        if (parseInt) {
          const parsed = Number.parseInt(strValue, 10);

          if (Number.isNaN(parsed)) {
            throw new AppConfigError(`Failed to parseInt(${strValue})`);
          }

          return parse(parsed, { shouldFlatten: true });
        }

        if (parseFloat) {
          const parsed = Number.parseFloat(strValue);

          if (Number.isNaN(parsed)) {
            throw new AppConfigError(`Failed to parseFloat(${strValue})`);
          }

          return parse(parsed, { shouldFlatten: true });
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
