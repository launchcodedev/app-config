import type { ParsingExtension } from '@app-config/core';
import { named, forKey, validateOptions } from '@app-config/extension-utils';
import isEqual from 'lodash.isequal';

/** Checks if two values are equal */
export function eqDirective(): ParsingExtension {
  return named(
    '$eq',
    forKey(
      '$eq',
      validateOptions(
        (SchemaBuilder) => SchemaBuilder.arraySchema(SchemaBuilder.fromJsonSchema({})),
        (values) => async (parse) => {
          for (const a of values) {
            for (const b of values) {
              if (a === b) continue;
              if (isEqual(a, b)) continue;

              return parse(false, { shouldFlatten: true });
            }
          }

          return parse(true, { shouldFlatten: true });
        },
      ),
    ),
  );
}
