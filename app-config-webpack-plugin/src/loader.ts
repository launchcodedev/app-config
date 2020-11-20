import * as wp from 'webpack';
import { getOptions } from 'loader-utils';
import { loadValidatedConfig } from '@lcdev/app-config';

const loader: wp.loader.Loader = function AppConfigLoader() {
  if (this.cacheable) this.cacheable();

  const callback = this.async()!;
  const { headerInjection = false } = getOptions(this) || {};

  loadValidatedConfig()
    .then(({ fullConfig, filePaths }) => {
      if (filePaths) {
        filePaths.forEach((filePath) => this.addDependency(filePath));
      }

      // NOTE: when using webpack-dev-server, we'll just ignore the headerInjection
      if (headerInjection && !process.env.WEBPACK_DEV_SERVER) {
        return callback(null, `export default window._appConfig;`);
      }

      callback(null, `export default ${JSON.stringify(fullConfig)};`);
    })
    .catch((err) => callback(err));
};

export default loader;
export const regex = /(^@(lcdev|servall)\/app-config)|(\.?app-config(\.\w+)?\.(toml|yml|yaml|json|json5))|(\.config-placeholder)/;
