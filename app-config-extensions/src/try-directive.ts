import type { ParsingExtension } from '@app-config/core';
import { Fallbackable } from '@app-config/core';
import { named, forKey, validateOptions } from '@app-config/extension-utils';

/** Try an operation, with a fallback ($try, $value and $fallback) */
export function tryDirective(): ParsingExtension {
  return named(
    '$try',
    forKey(
      '$try',
      validateOptions(
        (SchemaBuilder) =>
          SchemaBuilder.emptySchema()
            .addProperty('$value', SchemaBuilder.fromJsonSchema({}))
            .addProperty('$fallback', SchemaBuilder.fromJsonSchema({}))
            .addBoolean('$unsafe', {}, false),
        (value) => async (parse) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const { $value, $fallback, $unsafe } = value;

          try {
            return await parse($value, { shouldFlatten: true });
          } catch (error) {
            if (error instanceof Fallbackable || $unsafe) {
              return parse($fallback, { shouldFlatten: true });
            }

            throw error;
          }
        },
        { lazy: true },
      ),
    ),
  );
}
