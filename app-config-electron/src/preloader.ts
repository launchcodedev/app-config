import { loadValidatedConfig, loadUnvalidatedConfig } from "@app-config/config";
import { contextBridge } from "electron";

let additionalPreload: string | undefined;

for (const arg of process.argv) {
  if (arg.startsWith('--user-preload=')) {
    additionalPreload = arg.substr(15);
  }
}

contextBridge.exposeInMainWorld('appConfig', {
  loadUnvalidatedConfig,
  loadValidatedConfig,
})

if (additionalPreload) {
  require(additionalPreload);
}
