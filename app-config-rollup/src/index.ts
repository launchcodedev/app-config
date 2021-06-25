import type { Plugin } from 'rollup';
import { packageNameRegex } from '@app-config/utils';
import { loadValidatedConfig } from '@app-config/config';
import { currentEnvironment } from '../../app-config-node/dist';

export default function appConfigRollup(): Plugin {
  return {
    name: '@app-config/rollup',
    resolveId(source) {
      if (packageNameRegex.exec(source)) {
        return '.config-placeholder';
      }

      return null;
    },
    async load(id) {
      if (id === '.config-placeholder') {
        const { parsed: config } = await loadValidatedConfig();

        return `
          const config = ${JSON.stringify(config)};

          export { config };
          export default config;

          export function currentEnvironment() {
            return ${JSON.stringify(currentEnvironment()) ?? 'undefined'};
          }
        `;
      }

      return null;
    },
  };
}
