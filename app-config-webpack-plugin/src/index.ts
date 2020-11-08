import { join } from 'path';
import { Compiler } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { loadValidatedConfig } from '@lcdev/app-config';
import { regex } from './loader';

// loader is the filepath, not the export
const loader = require.resolve('./loader');

type Options = { headerInjection?: boolean };

export default class AppConfigPlugin {
  headerInjection: boolean;

  constructor({ headerInjection = false }: Options = {}) {
    this.headerInjection = headerInjection;
  }

  static loader = loader;
  static regex = regex;

  apply(compiler: Compiler) {
    if (this.headerInjection && !process.env.WEBPACK_DEV_SERVER) {
      this.injectHead(compiler);
    }

    this.interceptImports(compiler);
  }

  interceptImports(compiler: Compiler) {
    compiler.hooks.normalModuleFactory.tap('AppConfigPlugin', (factory) => {
      factory.hooks.beforeResolve.tapPromise('AppConfigPlugin', async (resolve) => {
        if (!resolve) return;

        if (resolve.request === '@lcdev/app-config' || resolve.request === 'app-config') {
          const { filePaths } = await loadValidatedConfig();

          if (filePaths?.length) {
            [resolve.request] = filePaths;
          } else {
            resolve.request = join(__dirname, '..', '.config-placeholder');
          }
        }

        return resolve as unknown;
      });
    });
  }

  injectHead(compiler: Compiler) {
    compiler.hooks.compilation.tap('AppConfigPlugin', (compilation) => {
      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tapPromise(
        'AppConfigPlugin',
        async ({ headTags, ...html }) => {
          const { fullConfig } = await loadValidatedConfig();

          // remove placeholder <script id="app-config"></script> if it exists
          const newTags = headTags.filter(({ attributes }) => attributes.id !== 'app-config');

          newTags.push({
            tagName: 'script',
            attributes: { id: 'app-config', type: 'text/javascript' },
            innerHTML: `window._appConfig = JSON.parse('${JSON.stringify(fullConfig)}')`,
            voidTag: false,
          });

          return {
            ...html,
            headTags: newTags,
          };
        },
      );
    });
  }
}

export { regex, loader };
