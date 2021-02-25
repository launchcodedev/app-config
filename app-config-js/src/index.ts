import { ParsingExtension } from '@app-config/core';
import { forKey, validateOptions } from '@app-config/extension-utils';

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

export default function jsModuleDirective(): ParsingExtension {
  return forKey(
    '$jsModule',
    validateOptions(
      (SchemaBuilder) => SchemaBuilder.stringSchema(),
      (value) => async (parse) => {
        let loaded: any = await import(value);

        if (!loaded) {
          return parse(loaded, { shouldFlatten: true });
        }

        if ('default' in loaded) {
          loaded = loaded.default;
        }

        if (typeof loaded === 'function') {
          loaded = loaded();
        }

        return parse(loaded, { shouldFlatten: true });
      },
    ),
  );
}
