import type { ParsingExtension } from '@app-config/core';
import { named, forKey } from '@app-config/extension-utils';

/** Properties that are removed, used by references */
export function hiddenDirective(): ParsingExtension {
  return named(
    '$hidden',
    forKey('$hidden', () => async (parse) => {
      return parse({}, { shouldMerge: true });
    }),
  );
}
