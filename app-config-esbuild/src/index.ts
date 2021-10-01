import type { Plugin } from 'esbuild';
import path from 'path';
import { ConfigLoadingOptions, loadValidatedConfig } from '@app-config/config';
import { generateModuleText, packageNameRegex } from '@app-config/utils';
import { loadSchema, SchemaLoadingOptions } from '@app-config/schema';

export interface Options {
  useGlobalNamespace?: boolean;
  loadingOptions?: ConfigLoadingOptions;
  schemaLoadingOptions?: SchemaLoadingOptions;
  injectValidationFunction?: boolean;
  noBundledConfig?: boolean;
}

export const createPlugin = ({
  useGlobalNamespace = true,
  loadingOptions,
  schemaLoadingOptions,
  injectValidationFunction = true,
  noBundledConfig = false,
}: Options = {}): Plugin => ({
  name: '@app-config/esbuild',
  setup(build) {
    build.onResolve({ filter: packageNameRegex }, (args) => ({
      path: args.path,
      namespace: '@app-config/esbuild',
    }));

    build.onLoad({ filter: /.*/, namespace: '@app-config/esbuild' }, async () => {
      if (noBundledConfig) {
        const { validationFunctionCode } = await loadSchema(schemaLoadingOptions);

        const code = generateModuleText('no-config', {
          environment: undefined,
          useGlobalNamespace: true,
          validationFunctionCode: injectValidationFunction ? validationFunctionCode : undefined,
          esmValidationCode: true,
        });

        return {
          loader: 'js',
          contents: code,
          resolveDir: path.parse(process.cwd()).root,
          watchFiles: [],
        };
      }

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
