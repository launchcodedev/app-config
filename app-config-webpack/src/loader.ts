import { getOptions, parseQuery } from 'loader-utils';
import { loadValidatedConfig } from '@app-config/main';
import { currentEnvironment, asEnvOptions } from '@app-config/node';
import { packageNameRegex } from '@app-config/utils';
import type { Options } from './index';

type LoaderContext = Parameters<typeof getOptions>[0];
interface Loader extends LoaderContext {}

const privateName = '_appConfig';

const loader = function AppConfigLoader(this: Loader) {
  if (this.cacheable) this.cacheable();

  const callback = this.async()!;
  const {
    noGlobal = false,
    loading = {},
    schemaLoading,
  }: Options = {
    ...getOptions(this),
    ...parseQuery(this.resourceQuery),
  };

  loadValidatedConfig(loading, schemaLoading)
    .then(({ fullConfig, filePaths, validationFunctionCode }) => {
      if (filePaths) {
        filePaths.forEach((filePath) => this.addDependency(filePath));
      }

      const generateText = (config: string) => {
        let generatedText: string;

        if (noGlobal) {
          generatedText = `
            const config = ${config};

            export { config };
            export default config;
          `;
        } else {
          generatedText = `
            const configValue = ${config};

            const globalNamespace = (typeof window === 'undefined' ? globalThis : window) || {};

            // if the global was already defined, use it
            const config = (globalNamespace.${privateName} || configValue);

            // if the global is frozen then it was set by electron and we can't change it, but we'll set it if we can
            if (
              typeof globalNamespace.${privateName} === 'undefined' ||
              !Object.isFrozen(globalNamespace.${privateName})
            ) {
              globalNamespace.${privateName} = config;
            }

            export { config };
            export default config;
          `;
        }

        if (validationFunctionCode) {
          generatedText = `${generatedText}
            ${/* nest the generated commonjs module here */ ''}
            function genValidateConfig(){
              const validateConfigModule = {};
              (function(module){
                ${validationFunctionCode()}
              })(validateConfigModule);
              return validateConfigModule.exports;
            }

            ${/* marking as pure always allows tree shaking in webpack when using es modules */ ''}
            export const validateConfig = /*#__PURE__*/ genValidateConfig();
          `;
        }

        const { environmentOverride, environmentAliases, environmentSourceNames } = loading;

        generatedText = `${generatedText}
          export function currentEnvironment() {
            return ${
              JSON.stringify(
                currentEnvironment(
                  asEnvOptions(environmentOverride, environmentAliases, environmentSourceNames),
                ),
              ) ?? 'undefined'
            };
          }
        `;

        return generatedText;
      };

      return callback(null, generateText(JSON.stringify(fullConfig)));
    })
    .catch((err) => {
      this.emitWarning(new Error(`There was an error when trying to load @app-config`));

      callback(err);
    });
};

export default loader;
export const regex = packageNameRegex;
