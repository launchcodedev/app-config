import type { ParsingExtension } from '@app-config/core';
import { AppConfigError } from '@app-config/core';
import { named, forKey, validateOptions, composeExtensions } from '@app-config/extension-utils';

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
          const parsed = Number.parseFloat(primitive);

          if (Number.isNaN(parsed)) {
            throw new AppConfigError(`Failed to $parseFloat(${primitive})`);
          }

          return parse(parsed, { shouldFlatten: true });
        }

        throw new AppConfigError(`Failed to $parseFloat(${parsed.toJSON()}) - invalid input type`);
      }),
      forKey('$parseInt', (value) => async (parse) => {
        const parsed = await parse(value);
        const primitive = parsed.asPrimitive();

        if (typeof primitive === 'number') {
          return parse(primitive | 0, { shouldFlatten: true });
        }

        if (typeof primitive === 'string') {
          const parsed = Number.parseInt(primitive, 10);

          if (Number.isNaN(parsed)) {
            throw new AppConfigError(`Failed to $parseInt(${primitive})`);
          }

          return parse(parsed, { shouldFlatten: true });
        }

        throw new AppConfigError(`Failed to $parseInt(${parsed.toJSON()}) - invalid input type`);
      }),
    ]),
  );
}
