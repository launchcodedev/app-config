import { join } from 'path';
import { Compiler } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import { ConfigLoadingOptions, SchemaLoadingOptions } from '@app-config/main';
import { regex } from './loader';

// loader is the filepath, not the export
const loader = require.resolve('./loader');

export interface Options {
  headerInjection?: boolean;
  noGlobal?: boolean;
  loading?: ConfigLoadingOptions;
  schemaLoading?: SchemaLoadingOptions;
  intercept?: RegExp;
}

export default class AppConfigPlugin {
  headerInjection: boolean;
  noGlobal: boolean;
  loadingOptions?: ConfigLoadingOptions;
  schemaLoadingOptions?: SchemaLoadingOptions;
  intercept: RegExp;

  constructor({
    headerInjection = false,
    noGlobal = false,
    loading,
    schemaLoading,
    intercept,
  }: Options = {}) {
    this.headerInjection = headerInjection;
    this.noGlobal = noGlobal;
    this.loadingOptions = loading;
    this.schemaLoadingOptions = schemaLoading;
    this.intercept = intercept ?? AppConfigPlugin.regex;
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
      factory.hooks.beforeResolve.tapPromise(
        'AppConfigPlugin',
        async (resolve?: { request: string }) => {
          if (!resolve) return;

          if (this.intercept.test(resolve.request)) {
            const queryString = JSON.stringify({
              loading: this.loadingOptions,
              schemaLoading: this.schemaLoadingOptions,
              noGlobal: this.noGlobal,
            });

            // eslint-disable-next-line no-param-reassign
            resolve.request = `${join(__dirname, '..', '.config-placeholder')}?${queryString}`;
          }
        },
      );
    });
  }

  injectHead(compiler: Compiler) {
    compiler.hooks.compilation.tap('AppConfigPlugin', (compilation) => {
      HtmlWebpackPlugin.getHooks(compilation).alterAssetTagGroups.tapPromise(
        'AppConfigPlugin',
        async ({ headTags, ...html }) => {
          // remove placeholder <script id="app-config"></script> if it exists
          const newTags = headTags.filter(({ attributes }) => attributes.id !== 'app-config');

          newTags.push({
            tagName: 'script',
            attributes: { id: 'app-config', type: 'text/javascript' },
            innerHTML: ``,
            voidTag: false,
            meta: {},
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
