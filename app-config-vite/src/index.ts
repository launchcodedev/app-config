import rollupPlugin, { Options } from '@app-config/rollup';
import type { Plugin } from 'vite';

export * from '@app-config/rollup';

export default function appConfigVite(options: Options = {}): Plugin {
  const plugin = rollupPlugin(options);

  return {
    ...plugin,
    name: '@app-config/vite',

    async handleHotUpdate({ server, file }) {
      if (plugin.currentFilePaths?.includes(file)) {
        server.ws.send({
          type: 'full-reload',
          path: '@app-config/main',
        });

        return [];
      }
    },
  };
}
