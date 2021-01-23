import * as wp from 'webpack';
import { getOptions, stringifyRequest } from 'loader-utils';
import type { Options } from './index';
import { loadConfig } from './compat';

const loader: wp.loader.Loader = function AppConfigLoader() {
  if (this.cacheable) this.cacheable();

  const callback = this.async()!;
  const { headerInjection = false, loading, schemaLoading }: Options = getOptions(this) || {};

  loadConfig(loading, schemaLoading)
    .then(({ fullConfig, filePaths, validationFunctionCode }) => {
      if (filePaths) {
        filePaths.forEach((filePath) => this.addDependency(stringifyRequest(this, filePath)));
      }

      const generateText = (config: string) => {
        let generatedText = `
          const win = window || globalThis || {};

          if (!win._appConfig) {
            win._appConfig = ${config};
          }

          const config = win._appConfig;

          export { config };
          export default config;
        `;

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

        return generatedText;
      };

      // NOTE: when using webpack-dev-server, we'll just ignore the headerInjection
      if (headerInjection && !process.env.WEBPACK_DEV_SERVER) {
        return callback(null, generateText('window._appConfig'));
      }

      return callback(null, generateText(JSON.stringify(fullConfig)));
    })
    .catch((err) => callback(err));
};

export default loader;
export const regex = /(^@(lcdev|servall)\/app-config)|(\.?app-config(\.\w+)?\.(toml|yml|yaml|json|json5))|(\.config-placeholder)/;
