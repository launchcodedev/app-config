import { join } from 'path';
import { Compiler } from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';
import type { ConfigLoadingOptions, SchemaLoadingOptions } from '@app-config/main';

import { regex } from './loader';

// loader is the filepath, not the export
const loader = require.resolve('./loader');

export interface Options {
  headerInjection?: boolean;
  useGlobalNamespace?: boolean;
  loadingOptions?: ConfigLoadingOptions;
  schemaLoadingOptions?: SchemaLoadingOptions;
  intercept?: RegExp;
  injectValidationFunction?: boolean;
  noBundledConfig?: boolean;

  /** @deprecated use useGlobalNamespace instead */
  noGlobal?: boolean;
  /** @deprecated use loadingOptions instead */
  loading?: ConfigLoadingOptions;
  /** @deprecated use schemaLoadingOptions instead */
  schemaLoading?: SchemaLoadingOptions;
}

export default class AppConfigPlugin implements Options {
  headerInjection: boolean;
  useGlobalNamespace: boolean;
  loadingOptions?: ConfigLoadingOptions;
  schemaLoadingOptions?: SchemaLoadingOptions;
  injectValidationFunction: boolean;
  noBundledConfig: boolean;
  intercept: RegExp;

  constructor(options: Options = {}) {
    this.headerInjection = options.headerInjection ?? false;
    this.useGlobalNamespace = options.useGlobalNamespace ?? !options.noGlobal;
    this.loadingOptions = options.loadingOptions ?? options.loading;
    this.schemaLoadingOptions = options.schemaLoadingOptions ?? options.schemaLoading;
    this.injectValidationFunction = options.injectValidationFunction ?? true;
    this.noBundledConfig = options.noBundledConfig ?? false;
    this.intercept = options.intercept ?? AppConfigPlugin.regex;
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
              headerInjection: this.headerInjection,
              useGlobalNamespace: this.useGlobalNamespace,
              loadingOptions: this.loadingOptions,
              schemaLoadingOptions: this.schemaLoadingOptions,
              injectValidationFunction: this.injectValidationFunction,
              noBundledConfig: this.noBundledConfig,

              // deprecated options
              noGlobal: !this.useGlobalNamespace,
              loading: this.loadingOptions,
              schemaLoading: this.schemaLoadingOptions,
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
