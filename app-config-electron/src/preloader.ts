import { loadValidatedConfig, loadUnvalidatedConfig } from '@app-config/config';
import { contextBridge } from 'electron';

let additionalPreload: string | undefined;

for (const arg of process.argv) {
  if (arg.startsWith('--user-preload=')) {
    additionalPreload = arg.substr(15);
  }
}

contextBridge.exposeInMainWorld('appConfig', {
  loadUnvalidatedConfig,
  loadValidatedConfig,
});

// This seems to be how electron does preload scripts https://github.com/electron/electron/issues/2406 maybe there's a better way?
/* eslint-disable import/no-dynamic-require, global-require */
if (additionalPreload) {
  require(additionalPreload);
}
