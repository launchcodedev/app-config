const webpackPreprocessor = require('@cypress/webpack-preprocessor');
const { default: AppConfigPlugin } = require('@lcdev/app-config-webpack-plugin');

module.exports = (on) => {
  const options = {
    webpackOptions: {
      mode: 'development',
      module: {
        rules: [
          { test: AppConfigPlugin.regex, use: { loader: AppConfigPlugin.loader } },
          {
            test: /\.jsx?$/,
            exclude: [/node_modules/],
            use: [
              {
                loader: 'babel-loader',
                options: {
                  presets: ['@babel/preset-env'],
                },
              },
            ],
          },
          {
            test: /\.tsx?$/,
            use: 'ts-loader',
            exclude: /node_modules/,
          },
        ],
      },
      plugins: [new AppConfigPlugin()],
    },
  };

  on('file:preprocessor', webpackPreprocessor(options));
};
