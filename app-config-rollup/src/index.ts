import type { Plugin } from 'rollup';
import { generateModuleText, packageNameRegex } from '@app-config/utils';
import { ConfigLoadingOptions, loadValidatedConfig } from '@app-config/config';
import { asEnvOptions, currentEnvironment } from '@app-config/node';
import type { SchemaLoadingOptions } from '@app-config/schema';

export interface Options {
  readGlobal?: boolean;
  injectValidationFunction?: boolean;
  loadingOptions?: ConfigLoadingOptions;
  schemaLoadingOptions?: SchemaLoadingOptions;
}

// vite resolves first before passing to the rollup plugin
export const appConfigImportRegex = /(app-config|app-config-main)\/dist(\/es)?\/index\.js/;

export default function appConfigRollup({
  readGlobal,
  injectValidationFunction,
  loadingOptions,
  schemaLoadingOptions,
}: Options = {}): Plugin & { currentFilePaths?: string[] } {
  const currentFilePaths: string[] = [];

  return {
    name: '@app-config/rollup',
    currentFilePaths,
    resolveId(source) {
      if (packageNameRegex.exec(source) || appConfigImportRegex.exec(source)) {
        return '.config-placeholder';
      }

      return null;
    },
    async load(id) {
      if (packageNameRegex.exec(id) || appConfigImportRegex.exec(id)) {
        const { fullConfig, validationFunctionCode, filePaths } = await loadValidatedConfig(
          loadingOptions,
          schemaLoadingOptions,
        );

        if (filePaths) {
          currentFilePaths.length = 0;
          currentFilePaths.push(...filePaths);
        }

        return generateModuleText(fullConfig, {
          esm: true,
          noGlobal: !readGlobal,
          currentEnvironment: currentEnvironment(
            asEnvOptions(
              loadingOptions?.environmentOverride,
              loadingOptions?.environmentAliases,
              loadingOptions?.environmentSourceNames,
            ),
          ),
          validationFunctionCode: injectValidationFunction ? validationFunctionCode : undefined,
        });
      }

      return null;
    },
  };
}
