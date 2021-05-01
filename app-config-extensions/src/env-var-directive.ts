import type { ParsingExtension } from '@app-config/core';
import { named, forKey, validationFunction, ValidationFunction } from '@app-config/extension-utils';
import { AppConfigError, InObject } from '@app-config/core';
import {
  asEnvOptions,
  currentEnvironment,
  defaultAliases,
  EnvironmentAliases,
} from '@app-config/node';

/** Substitutes environment variables */
export function envVarDirective(
  aliases: EnvironmentAliases = defaultAliases,
  environmentOverride?: string,
  environmentSourceNames?: string[] | string,
): ParsingExtension {
  const environment = currentEnvironment(
    asEnvOptions(environmentOverride, aliases, environmentSourceNames),
  );

  return named(
    '$envVar',
    forKey('$envVar', (value, key, ctx) => async (parse) => {
      let name: string;
      let parseInt = false;
      let parseFloat = false;
      let parseBool = false;

      if (typeof value === 'string') {
        name = value;
      } else {
        validateObject(value, [...ctx, key]);
        if (Array.isArray(value)) throw new AppConfigError('$envVar was given an array');

        const resolved = (await parse(value.name)).toJSON();
        validateString(resolved, [...ctx, key, [InObject, 'name']]);

        parseInt = !!(await parse(value.parseInt)).toJSON();
        parseFloat = !!(await parse(value.parseFloat)).toJSON();
        parseBool = !!(await parse(value.parseBool)).toJSON();
        name = resolved;
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

      if (!resolvedValue && name === 'APP_CONFIG_ENV') {
        resolvedValue = environment;
      }

      if (resolvedValue) {
        return parseValue(resolvedValue);
      }

      if (typeof value === 'object' && value.fallback !== undefined) {
        const fallback = (await parse(value.fallback)).toJSON();
        const allowNull = (await parse(value.allowNull)).toJSON();

        if (allowNull) {
          validateStringOrNull(fallback, [...ctx, key, [InObject, 'fallback']]);
        } else {
          validateString(fallback, [...ctx, key, [InObject, 'fallback']]);
        }

        return parseValue(fallback);
      }

      throw new AppConfigError(`$envVar could not find ${name} environment variable`);
    }),
  );
}

const validateObject: ValidationFunction<
  Record<string, any>
> = validationFunction(({ emptySchema }) => emptySchema().addAdditionalProperties());

const validateString: ValidationFunction<string> = validationFunction(({ stringSchema }) =>
  stringSchema(),
);

const validateStringOrNull: ValidationFunction<
  string | null
> = validationFunction(({ fromJsonSchema }) =>
  fromJsonSchema({ type: ['null', 'string'] } as const),
);
