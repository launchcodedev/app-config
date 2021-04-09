import type { ParsingExtension, ParsingExtensionKey } from '@app-config/core';
import { parseValue, Root, AppConfigError } from '@app-config/core';
import { Json } from '@app-config/utils';
import { SchemaBuilder } from '@serafin/schema-builder';

export function composeExtensions(extensions: ParsingExtension[]): ParsingExtension {
  return (value, [[k]]) => {
    if (k !== Root) return false;

    return (_, __, source) => parseValue(value, source, extensions, { shouldFlatten: true });
  };
}

export function forKey(
  key: string | string[],
  parsingExtension: ParsingExtension,
): ParsingExtension {
  const shouldApply = ([_, k]: ParsingExtensionKey) => {
    if (typeof k !== 'string') return false;

    if (Array.isArray(key)) {
      return key.includes(k);
    }

    return key === k;
  };

  return (value, parentKeys, context) => {
    if (shouldApply(parentKeys[0])) {
      return parsingExtension(value, parentKeys, context);
    }

    return false;
  };
}

export class ParsingExtensionInvalidOptions extends AppConfigError {}

export function validateOptions<T extends Json>(
  builder: (builder: typeof SchemaBuilder) => SchemaBuilder<T>,
  extension: ParsingExtension<T>,
  { lazy = false }: { lazy?: boolean } = {},
): ParsingExtension {
  const validate: ValidationFunction<T> = validationFunction(builder);

  return (value, parentKeys, context) => {
    return async (parse, ...args) => {
      let valid: unknown;

      if (lazy) {
        valid = value;
      } else {
        valid = (await parse(value)).toJSON();
      }

      validate(valid, parentKeys);

      const call = extension(valid, parentKeys, context);

      if (call) {
        return call(parse, ...args);
      }

      throw new AppConfigError(
        `A parsing extension returned as non-applicable, when using validateOptions. This isn't supported.`,
      );
    };
  };
}

export type ValidationFunction<T> = (value: any, ctx: ParsingExtensionKey[]) => asserts value is T;

export function validationFunction<T>(
  builder: (builder: typeof SchemaBuilder) => SchemaBuilder<T>,
): ValidationFunction<T> {
  const schema = builder(SchemaBuilder);

  schema.cacheValidationFunction();

  return (value, ctx): asserts value is T => {
    try {
      schema.validate(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';

      const parents =
        [...ctx]
          .reverse()
          .map(([, k]) => k)
          .filter((v) => !!v)
          .join('.') || 'root';

      throw new ParsingExtensionInvalidOptions(`Validation failed in "${parents}": ${message}`);
    }
  };
}
