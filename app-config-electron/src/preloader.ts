import { contextBridge } from 'electron';
import { logger } from '@app-config/logging';

let additionalPreload: string | undefined;
let config;

for (const arg of process.argv) {
  if (arg.startsWith('--user-preload=')) {
    additionalPreload = arg.substr(15);
  }

  if (arg.startsWith('--app-config=')) {
    try {
      config = JSON.parse(arg.substr(13));
    } catch (err) {
      logger.error(`Got invalid JSON from config: ${err}`);
    }
  }
}

contextBridge.exposeInMainWorld('_appConfig', config);
logger.info(`⚙️ Injected app-config`);

// This seems to be how electron does preload scripts https://github.com/electron/electron/issues/2406 maybe there's a better way?
/* eslint-disable import/no-dynamic-require, global-require */
if (additionalPreload) {
  require(additionalPreload);
}
