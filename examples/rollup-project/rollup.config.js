import appConfigRollup from '@app-config/rollup';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/index.js',
    format: 'cjs',
  },
  plugins: [appConfigRollup()],
};
