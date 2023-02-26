import rollupPlugin, { Options } from '@app-config/rollup';
import type { Plugin, FSWatcher } from 'vite';

export * from '@app-config/rollup';

export default function appConfigVite(options: Options = {}): Plugin {
  const plugin = rollupPlugin(options);

  let watcher: FSWatcher | undefined;

  return {
    ...plugin,
    name: '@app-config/vite',

    configureServer(server) {
      watcher = server.watcher;
    },

    async load(id) {
      // @ts-ignore
      const result = await plugin.load!.call(this, id);

      watcher?.add(plugin.currentFilePaths ?? []);

      return result;
    },

    async handleHotUpdate({ server, file }) {
      if (plugin.currentFilePaths?.includes(file)) {
        server.ws.send({ type: 'full-reload' });

        return [];
      }
    },
  } as Plugin;
}
