import type { Plugin } from 'rollup';
import { packageNameRegex } from '@app-config/utils';
import { ConfigLoadingOptions, loadValidatedConfig } from '@app-config/config';
import { asEnvOptions, currentEnvironment } from '@app-config/node';
import type { SchemaLoadingOptions } from '@app-config/schema';

interface Options {
  loadingOptions?: ConfigLoadingOptions;
  schemaLoadingOptions?: SchemaLoadingOptions;
}

export default function appConfigRollup({
  loadingOptions,
  schemaLoadingOptions,
}: Options = {}): Plugin {
  return {
    name: '@app-config/rollup',
    resolveId(source) {
      if (packageNameRegex.exec(source)) {
        return '.config-placeholder';
      }

      return null;
    },
    async load(id) {
      if (id === '.config-placeholder') {
        const { parsed: config } = await loadValidatedConfig(loadingOptions, schemaLoadingOptions);

        return `
          const config = ${JSON.stringify(config)};

          export { config };
          export default config;

          export function currentEnvironment() {
            return ${
              JSON.stringify(
                currentEnvironment(
                  asEnvOptions(
                    loadingOptions?.environmentOverride,
                    loadingOptions?.environmentAliases,
                    loadingOptions?.environmentSourceNames,
                  ),
                ),
              ) ?? 'undefined'
            };
          }
        `;
      }

      return null;
    },
  };
}
