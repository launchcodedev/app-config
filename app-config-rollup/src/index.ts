import type { Plugin } from 'rollup';
import { generateModuleText, packageNameRegex } from '@app-config/utils';
import { ConfigLoadingOptions, loadValidatedConfig } from '@app-config/config';
import type { SchemaLoadingOptions } from '@app-config/schema';

export interface Options {
  useGlobalNamespace?: boolean;
  loadingOptions?: ConfigLoadingOptions;
  schemaLoadingOptions?: SchemaLoadingOptions;
  injectValidationFunction?: boolean;

  /** @deprecated use useGlobalNamespace instead */
  readGlobal?: boolean;
}

// vite resolves first before passing to the rollup plugin
export const appConfigImportRegex = /(app-config|app-config-main)\/dist(\/es)?\/index\.js/;

export default function appConfigRollup({
  useGlobalNamespace,
  loadingOptions,
  schemaLoadingOptions,
  injectValidationFunction,

  readGlobal,
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
        const { fullConfig, environment, validationFunctionCode, filePaths } =
          await loadValidatedConfig(loadingOptions, schemaLoadingOptions);

        if (filePaths) {
          currentFilePaths.length = 0;
          currentFilePaths.push(...filePaths);
        }

        return generateModuleText(fullConfig, {
          environment,
          useGlobalNamespace: useGlobalNamespace ?? readGlobal ?? true,
          validationFunctionCode: injectValidationFunction ? validationFunctionCode : undefined,
          esmValidationCode: true,
        });
      }

      return null;
    },
  };
}
