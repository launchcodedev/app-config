import type {
  ParsingExtension,
  ParsingExtensionKey,
  ParsingExtensionTransform,
} from '@app-config/core';
import { parseValue, Root, AppConfigError } from '@app-config/core';
import { SchemaBuilder } from '@serafin/schema-builder';

export function composeExtensions(extensions: ParsingExtension[]): ParsingExtension {
  return (value, [k]) => {
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

  return (value, ctxKey, ctx) => {
    if (shouldApply(ctxKey)) {
      return parsingExtension(value, ctxKey, ctx);
    }

    return false;
  };
}

export class ParsingExtensionInvalidOptions extends AppConfigError {}

export function validateOptions<T>(
  builder: (builder: typeof SchemaBuilder) => SchemaBuilder<T>,
  extension: (
    value: T,
    key: ParsingExtensionKey,
    context: ParsingExtensionKey[],
  ) => ParsingExtensionTransform | false,
): ParsingExtension {
  const schema = builder(SchemaBuilder);

  schema.cacheValidationFunction();

  return (value, ctxKey, ctx) => {
    return async (parse, ...args) => {
      const valid = ((await parse(value)).toJSON() as unknown) as T;

      try {
        schema.validate(valid);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'unknown';

        const parents =
          [...ctx, ctxKey]
            .map(([, k]) => k)
            .filter((v) => !!v)
            .join('.') || 'root';

        throw new ParsingExtensionInvalidOptions(`Validation failed in "${parents}": ${message}`);
      }

      const call = extension(valid, ctxKey, ctx);

      if (call) {
        return call(parse, ...args);
      } else {
        throw new AppConfigError(
          `A parsing extension returned as non-applicable, when using validateOptions. This isn't supported.`,
        );
      }
    };
  };
}
