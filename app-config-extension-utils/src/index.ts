import type { ParsingExtension, ParsingExtensionKey } from '@app-config/core';
import { parseValue, Root } from '@app-config/core';

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

export function composeExtensions(extensions: ParsingExtension[]): ParsingExtension {
  return (value, [k]) => {
    if (k !== Root) return false;

    return (_, __, source) => parseValue(value, source, extensions, { shouldFlatten: true });
  };
}
