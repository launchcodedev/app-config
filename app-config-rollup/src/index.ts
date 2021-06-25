import type { Plugin } from 'rollup';
import { packageNameRegex } from '@app-config/utils';
import { ConfigLoadingOptions, loadValidatedConfig } from '@app-config/config';
import { asEnvOptions, currentEnvironment } from '@app-config/node';
import type { SchemaLoadingOptions } from '@app-config/schema';

interface Options {
  readGlobal?: boolean;
  injectValidationFunction?: boolean;
  loadingOptions?: ConfigLoadingOptions;
  schemaLoadingOptions?: SchemaLoadingOptions;
}

// vite resolves first before passing to the rollup plugin
const manualImport = /(app-config|app-config-main)\/dist(\/es)?\/index\.js/;

export default function appConfigRollup({
  readGlobal,
  injectValidationFunction,
  loadingOptions,
  schemaLoadingOptions,
}: Options = {}): Plugin {
  return {
    name: '@app-config/rollup',
    resolveId(source) {
      if (packageNameRegex.exec(source) || manualImport.exec(source)) {
        return '.config-placeholder';
      }

      return null;
    },
    async load(id) {
      if (packageNameRegex.exec(id) || manualImport.exec(id)) {
        const { parsed: config, validationFunctionCode } = await loadValidatedConfig(
          loadingOptions,
          schemaLoadingOptions,
        );

        // TODO: alternative for addDependecy with filePaths

        let generatedText: string;

        if (readGlobal) {
          generatedText = `
            const configValue = ${JSON.stringify(config)};

            const globalNamespace = (typeof window === 'undefined' ? globalThis : window) || {};

            // if the global was already defined, use it (and define it if not)
            const config = globalNamespace._appConfig =
              (globalNamespace._appConfig || configValue);
          `;
        } else {
          generatedText = `
            const config = ${JSON.stringify(config)};
          `;
        }

        if (injectValidationFunction && validationFunctionCode) {
          const [code, imports] = validationFunctionCode(true);

          generatedText = `${generatedText}
            ${imports}

            ${/* nest the generated commonjs module here */ ''}
            function genValidateConfig(){
              const validateConfigModule = {};
              (function(module){${code}})(validateConfigModule);
              return validateConfigModule.exports;
            }

            ${/* marking as pure allows tree shaking */ ''}
            export const validateConfig = /*#__PURE__*/ genValidateConfig();
          `;
        }

        return `
          ${generatedText}

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
