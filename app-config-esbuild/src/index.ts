import type { Plugin } from 'esbuild';
import path from 'path';
import { ConfigLoadingOptions, loadValidatedConfig } from '@app-config/config';
import { appConfigImportRegex, generateModuleText, packageNameRegex } from '@app-config/utils';
import type { SchemaLoadingOptions } from '@app-config/schema';

export interface Options {
  useGlobalNamespace?: boolean;
  loadingOptions?: ConfigLoadingOptions;
  schemaLoadingOptions?: SchemaLoadingOptions;
  injectValidationFunction?: boolean;
}

export const createPlugin = ({
  useGlobalNamespace = true,
  loadingOptions,
  schemaLoadingOptions,
  injectValidationFunction = true,
}: Options = {}): Plugin => ({
  name: '@app-config/esbuild',
  setup(build) {
    build.onResolve({ filter: packageNameRegex }, (args) => ({
      path: args.path,
      namespace: '@app-config/esbuild',
    }));

    build.onResolve({ filter: appConfigImportRegex }, (args) => ({
      path: args.path,
      namespace: '@app-config/esbuild',
    }));

    build.onLoad({ filter: /.*/, namespace: '@app-config/esbuild' }, async () => {
      const { fullConfig, environment, validationFunctionCode, filePaths } =
        await loadValidatedConfig(loadingOptions, schemaLoadingOptions);

      const code = generateModuleText(fullConfig, {
        environment,
        useGlobalNamespace,
        validationFunctionCode: injectValidationFunction ? validationFunctionCode : undefined,
        esmValidationCode: true,
      });

      return {
        loader: 'js',
        contents: code,
        resolveDir: path.parse(process.cwd()).root,
        watchFiles: filePaths,
      };
    });
  },
});

export default createPlugin;
