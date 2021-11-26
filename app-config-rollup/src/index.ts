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
export const appConfigImportRegex =
  /(app-config|app-config-main|@app-config\/main)\/dist(\/es)?\/index\.js/;

export default function appConfigRollup(
  options: Options = {},
): Plugin & { currentFilePaths?: string[] } {
  const currentFilePaths: string[] = [];

  return {
    name: '@app-config/rollup',
    currentFilePaths,
    resolveId(id) {
      if (shouldTransform(id)) {
        return { id, moduleSideEffects: false, external: false };
      }
    },
    async load(id) {
      if (shouldTransform(id)) {
        return loadConfig(options, currentFilePaths);
      }
    },
    async transform(_, id) {
      if (shouldTransform(id)) {
        return loadConfig(options, currentFilePaths);
      }
    },
  };
}

function shouldTransform(id: string) {
  return !!packageNameRegex.exec(id) || !!appConfigImportRegex.exec(id);
}

async function loadConfig(
  {
    useGlobalNamespace,
    loadingOptions,
    schemaLoadingOptions,
    injectValidationFunction,
    readGlobal,
  }: Options,
  currentFilePaths: string[],
) {
  const { fullConfig, environment, validationFunctionCode, filePaths } = await loadValidatedConfig(
    loadingOptions,
    schemaLoadingOptions,
  );

  if (filePaths) {
    currentFilePaths.splice(0);
    currentFilePaths.push(...filePaths);
  }

  const code = generateModuleText(fullConfig, {
    environment,
    useGlobalNamespace: useGlobalNamespace ?? readGlobal ?? true,
    validationFunctionCode: injectValidationFunction ? validationFunctionCode : undefined,
    esmValidationCode: true,
  });

  return {
    code,
    moduleSideEffects: false,
  };
}
