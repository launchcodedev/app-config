import { getOptions, parseQuery } from 'loader-utils';
import { loadValidatedConfig } from '@app-config/config';
import { generateModuleText, packageNameRegex } from '@app-config/utils';
import type { Options } from './index';

type LoaderContext = Parameters<typeof getOptions>[0];
interface Loader extends LoaderContext {}

const loader = function AppConfigLoader(this: Loader) {
  if (this.cacheable) this.cacheable();

  const callback = this.async()!;
  const options: Options = {
    ...getOptions(this),
    ...parseQuery(this.resourceQuery),
  };

  const useGlobalNamespace = options.useGlobalNamespace ?? !options.noGlobal;
  const loadingOptions = options.loadingOptions ?? options.loading ?? {};
  const schemaLoadingOptions = options.schemaLoadingOptions ?? options.schemaLoading;
  const injectValidationFunction = options.injectValidationFunction ?? true;

  loadValidatedConfig(loadingOptions, schemaLoadingOptions)
    .then(({ fullConfig, environment, filePaths, validationFunctionCode }) => {
      if (filePaths) {
        filePaths.forEach((filePath) => this.addDependency(filePath));
      }

      callback(
        null,
        generateModuleText(fullConfig, {
          environment,
          useGlobalNamespace,
          validationFunctionCode: injectValidationFunction ? validationFunctionCode : undefined,
          esmValidationCode: false,
        }),
      );
    })
    .catch((err) => {
      this.emitWarning(new Error(`There was an error when trying to load @app-config`));

      callback(err);
    });
};

export default loader;
export const regex = packageNameRegex;
