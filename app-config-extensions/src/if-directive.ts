import type { ParsingExtension } from '@app-config/core';
import { named, forKey, validateOptions } from '@app-config/extension-utils';

/** Checks a condition, uses then/else */
export function ifDirective(): ParsingExtension {
  return named(
    '$if',
    forKey(
      '$if',
      validateOptions(
        (SchemaBuilder) =>
          SchemaBuilder.emptySchema()
            .addProperty('$check', SchemaBuilder.fromJsonSchema({}))
            .addProperty('$then', SchemaBuilder.fromJsonSchema({}))
            .addProperty('$else', SchemaBuilder.fromJsonSchema({})),
        (value) => async (parse) => {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const { $check, $then, $else } = value;
          const condition = (await parse($check)).toJSON();

          if (condition) {
            return parse($then, { shouldFlatten: true });
          }

          return parse($else, { shouldFlatten: true });
        },
        { lazy: true },
      ),
    ),
  );
}
