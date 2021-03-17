const path = require('path');
const HtmlPlugin = require('html-webpack-plugin');
const { default: AppConfigPlugin } = require('@app-config/webpack');

const appConfigOptions = {
  headerInjection: true,
};

const appConfigStaticOptions = {
  noGlobal: true,
  intercept: /app-config-static/,
  loading: {
    fileNameBase: 'app-config-static',
  },
  schemaLoading: {
    fileNameBase: 'app-config-static.schema',
  },
};

module.exports = {
  mode: 'development',
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
          options: appConfigStaticOptions,
        },
      },
      {
        test: AppConfigPlugin.regex,
        use: { loader: AppConfigPlugin.loader, options: appConfigOptions },
      },
    ],
  },
  plugins: [
    new HtmlPlugin(),
    new AppConfigPlugin(appConfigOptions),
    new AppConfigPlugin(appConfigStaticOptions),
  ],
  devServer: {
    host: '0.0.0.0',
    port: 8993,
    disableHostCheck: true,
    historyApiFallback: true,
  },
};
