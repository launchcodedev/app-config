import appConfigVite from '@app-config/vite';

export default {
  plugins: [appConfigVite({ readGlobal: true, injectValidationFunction: true })],
};
