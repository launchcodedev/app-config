const { resolve } = require('path');

module.exports = {
  inputFiles: [resolve(__dirname, './src')],
  exclude: '**/*.test.*',

  mode: 'modules',
  strict: true,
  target: 'esnext',
  module: 'commonjs',
  moduleResolution: 'node',
  experimentalDecorators: true,
  esModuleInterop: true,
};
