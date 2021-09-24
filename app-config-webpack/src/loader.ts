import { getOptions, parseQuery } from 'loader-utils';
import { loadValidatedConfig } from '@app-config/main';
import { currentEnvironment, asEnvOptions } from '@app-config/node';
import { generateModuleText, packageNameRegex } from '@app-config/utils';
import type { Options } from './index';

type LoaderContext = Parameters<typeof getOptions>[0];
interface Loader extends LoaderContext {}

const loader = function AppConfigLoader(this: Loader) {
  if (this.cacheable) this.cacheable();

  const callback = this.async()!;
  const {
    noGlobal = false,
    loading = {},
    schemaLoading,
    injectValidationFunction = true,
  }: Options = {
    ...getOptions(this),
    ...parseQuery(this.resourceQuery),
  };

  loadValidatedConfig(loading, schemaLoading)
    .then(({ fullConfig, filePaths, validationFunctionCode }) => {
      if (filePaths) {
        filePaths.forEach((filePath) => this.addDependency(filePath));
      }

      const { environmentOverride, environmentAliases, environmentSourceNames } = loading;

      callback(
        null,
        generateModuleText(fullConfig, {
          esm: false,
          noGlobal,
          currentEnvironment: currentEnvironment(
            asEnvOptions(environmentOverride, environmentAliases, environmentSourceNames),
          ),
          validationFunctionCode: injectValidationFunction ? validationFunctionCode : undefined,
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
