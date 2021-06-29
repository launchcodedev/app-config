import { contextBridge } from 'electron';
import { inspect } from 'util';
import { logger } from '@app-config/logging';
import type { ExportedConfig } from '@app-config/main';

let additionalPreload: string | undefined;
let config: ExportedConfig | undefined;

for (const arg of process.argv) {
  if (arg.startsWith('--user-preload=')) {
    additionalPreload = arg.substr(15);
  }

  if (arg.startsWith('--app-config=')) {
    try {
      config = JSON.parse(arg.substr(13)) as ExportedConfig;
    } catch (err) {
      logger.error(`Got invalid JSON from config: ${inspect(err)}`);
    }
  }
}

if (config) {
  contextBridge.exposeInMainWorld('_appConfig', config);
  logger.info(`⚙️ Injected app-config`);
}

// This seems to be how electron does preload scripts https://github.com/electron/electron/issues/2406 maybe there's a better way?
/* eslint-disable import/no-dynamic-require, global-require */
if (additionalPreload) {
  require(additionalPreload);
}
