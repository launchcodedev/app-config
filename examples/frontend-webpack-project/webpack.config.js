const path = require('path');
const HtmlPlugin = require('html-webpack-plugin');
const { default: AppConfigPlugin } = require('@lcdev/app-config-webpack-plugin');

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
        test: AppConfigPlugin.regex,
        use: { loader: AppConfigPlugin.loader, options: { headerInjection: true } },
      },
    ],
  },
  plugins: [new HtmlPlugin(), new AppConfigPlugin({ headerInjection: true })],
  devServer: {
    host: '0.0.0.0',
    port: 8080,
    disableHostCheck: true,
    historyApiFallback: true,
  },
};
