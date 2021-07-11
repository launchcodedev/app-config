import type {
  ParsingContext,
  ParsingExtension,
  ParsingExtensionKey,
  ParsingExtensionTransform,
} from '@app-config/core';
import { parseValue, Root, AppConfigError } from '@app-config/core';
import { Json } from '@app-config/utils';
import { SchemaBuilder } from '@serafin/schema-builder';

export function composeExtensions(extensions: ParsingExtension[]): ParsingExtension {
  const composed: ParsingExtension = (value, [k], _, context) => {
    // only applies to the root - override the parsing extensions
    if (k !== Root) return false;

    return (_, __, source, baseExtensions) =>
      // restart the parse tree, but with additional extensions included
      parseValue(
        value,
        source,
        // ensures that a recursion doesn't happen
        baseExtensions.concat(extensions).filter((v) => v !== composed),
        { shouldFlatten: true },
        context,
      );
  };

  return composed;
}

export function named(name: string, parsingExtension: ParsingExtension): ParsingExtension {
  Object.defineProperty(parsingExtension, 'extensionName', { value: name });

  return parsingExtension;
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

  return (value, currentKey, parentKeys, context) => {
    if (shouldApply(currentKey)) {
      return parsingExtension(value, currentKey, parentKeys, context);
    }

    return false;
  };
}

export function keysToPath(keys: ParsingExtensionKey[]): string {
  if (keys.length === 0) return 'root';

  return (
    keys
      .map(([, k]) => k)
      .filter((v) => v)
      .join('.') || 'root'
  );
}

export class ParsingExtensionInvalidOptions extends AppConfigError {}

export function validateOptions<T extends Json>(
  builder: (builder: typeof SchemaBuilder) => SchemaBuilder<T>,
  extension: (
    value: T,
    key: ParsingExtensionKey,
    parentKeys: ParsingExtensionKey[],
    context: ParsingContext,
  ) => ParsingExtensionTransform | false,
  { lazy = false }: { lazy?: boolean } = {},
): ParsingExtension {
  const validate: ValidationFunction<T> = validationFunction(builder);

  return (value, key, parentKeys, context) => {
    return async (parse, ...args) => {
      let valid: unknown;

      if (lazy) {
        valid = value;
      } else {
        valid = (await parse(value)).toJSON();
      }

      validate(valid, [...parentKeys, key]);

      const call = extension(valid, key, parentKeys, context);

      if (call) {
        return call(parse, ...args);
      }

      throw new AppConfigError(
        `A parsing extension returned as non-applicable, when using validateOptions. This isn't supported.`,
      );
    };
  };
}

export type ValidationFunction<T> = (
  value: any,
  parentKeys: ParsingExtensionKey[],
) => asserts value is T;

export function validationFunction<T>(
  builder: (builder: typeof SchemaBuilder) => SchemaBuilder<T>,
): ValidationFunction<T> {
  const schema = builder(SchemaBuilder);

  schema.cacheValidationFunction();

  return (value, parentKeys): asserts value is T => {
    try {
      schema.validate(value);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown';

      throw new ParsingExtensionInvalidOptions(
        `Validation failed in "${keysToPath(parentKeys)}": ${message}`,
      );
    }
  };
}
