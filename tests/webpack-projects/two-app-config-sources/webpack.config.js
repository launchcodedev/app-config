const path = require('path');
const HtmlPlugin = require('html-webpack-plugin');
const { default: AppConfigPlugin } = require('@app-config/webpack');

// Important parts are in module->rules (the AppConfigPlugin.loader), and plugins
// AppConfigPlugin relies on HtmlPlugin (html-webpack-plugin), when using headerInjection

module.exports = {
  entry: './src/index.ts',
  output: {
    publicPath: '/',
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/,
      },
      {
        test: /app-config-static/,
        use: {
          loader: AppConfigPlugin.loader,
          options: {
            noGlobal: true,
            loading: {
              fileNameBase: 'app-config-static',
            },
          },
        },
      },
      {
        test: AppConfigPlugin.regex,
        use: { loader: AppConfigPlugin.loader, options: { headerInjection: true } },
      },
    ],
  },
  plugins: [
    new HtmlPlugin(),
    new AppConfigPlugin({ headerInjection: true }),
    new AppConfigPlugin({
      noGlobal: true,
      intercept: /app-config-static/,
      loading: {
        fileNameBase: 'app-config-static',
      },
      schemaLoading: {
        fileNameBase: 'app-config-static.schema',
      },
    }),
  ],
  devServer: {
    host: '0.0.0.0',
    port: 8993,
    disableHostCheck: true,
    historyApiFallback: true,
  },
};
