import { ParsingExtension } from '@app-config/core';
import { named, forKey, validateOptions } from '@app-config/extension-utils';
import { resolveFilepath } from '@app-config/node';

/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

export default function jsModuleDirective(): ParsingExtension {
  return named(
    '$jsModule',
    forKey(
      '$jsModule',
      validateOptions(
        (SchemaBuilder) => SchemaBuilder.stringSchema(),
        (value) => async (parse, _, context) => {
          const resolvedPath = resolveFilepath(context, value);

          let loaded: any = await import(resolvedPath);

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
    ),
  );
}
