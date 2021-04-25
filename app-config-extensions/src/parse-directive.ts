import type { ParsingExtension } from '@app-config/core';
import { AppConfigError } from '@app-config/core';
import { named, forKey, composeExtensions } from '@app-config/extension-utils';

/** Provides string parsing */
export function parseDirective(): ParsingExtension {
  return named(
    '$parse',
    composeExtensions([
      forKey('$parseBool', (value) => async (parse) => {
        const parsed = await parse(value);
        const primitive = parsed.asPrimitive();

        if (typeof primitive === 'string') {
          return parse(primitive.toLowerCase() === 'true' || primitive.toLowerCase() === '1', {
            shouldFlatten: true,
          });
        }

        return parse(!!parsed.toJSON(), { shouldFlatten: true });
      }),
      forKey('$parseFloat', (value) => async (parse) => {
        const parsed = await parse(value);
        const primitive = parsed.asPrimitive();

        if (typeof primitive === 'number') {
          return parse(primitive, { shouldFlatten: true });
        }

        if (typeof primitive === 'string') {
          const floatValue = Number.parseFloat(primitive);

          if (Number.isNaN(floatValue)) {
            throw new AppConfigError(`Failed to $parseFloat(${primitive})`);
          }

          return parse(floatValue, { shouldFlatten: true });
        }

        throw new AppConfigError(
          `Failed to $parseFloat(${parsed.toJSON() as string}) - invalid input type`,
        );
      }),
      forKey('$parseInt', (value) => async (parse) => {
        const parsed = await parse(value);
        const primitive = parsed.asPrimitive();

        if (typeof primitive === 'number') {
          // eslint-disable-next-line no-bitwise
          return parse(primitive | 0, { shouldFlatten: true });
        }

        if (typeof primitive === 'string') {
          const intValue = Number.parseInt(primitive, 10);

          if (Number.isNaN(intValue)) {
            throw new AppConfigError(`Failed to $parseInt(${primitive})`);
          }

          return parse(intValue, { shouldFlatten: true });
        }

        throw new AppConfigError(
          `Failed to $parseInt(${parsed.toJSON() as string}) - invalid input type`,
        );
      }),
    ]),
  );
}
