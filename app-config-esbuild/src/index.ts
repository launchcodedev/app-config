import type { Plugin } from 'esbuild';
import { loadValidatedConfig } from '@app-config/config';
import { currentEnvironment } from '@app-config/node';
import { generateModuleText, packageNameRegex } from '@app-config/utils';

const plugin: Plugin = {
  name: 'app-config',
  setup(build) {
    build.onResolve({ filter: packageNameRegex }, (args) => ({
      path: args.path,
      namespace: 'app-config-ns',
    }));

    build.onLoad({ filter: /.*/, namespace: 'app-config-ns' }, async () => {
      const { fullConfig, validationFunctionCode } = await loadValidatedConfig();

      const code = generateModuleText(fullConfig, {
        esm: true,
        noGlobal: false,
        currentEnvironment: currentEnvironment(),
        validationFunctionCode,
      });

      return {
        loader: 'js',
        contents: code,
      };
    });
  },
};

export default plugin;
