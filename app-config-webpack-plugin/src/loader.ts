import * as wp from 'webpack';
import { getOptions } from 'loader-utils';
import type { Options } from './index';
import { loadConfig } from './compat';

const loader: wp.loader.Loader = function AppConfigLoader() {
  if (this.cacheable) this.cacheable();

  const callback = this.async()!;
  const { headerInjection = false, loading, schemaLoading }: Options = getOptions(this) || {};

  loadConfig(loading, schemaLoading)
    .then(({ fullConfig, filePaths, validationFunction }) => {
      if (filePaths) {
        filePaths.forEach((filePath) => this.addDependency(filePath));
      }

      const generateText = (config: string) =>
        `
        const config = ${config};

        export { config };
        export default config;

        ${validationFunction ? `export const validateConfig = ${validationFunction};` : ''}
      `.replace(/\n/g, '');

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
