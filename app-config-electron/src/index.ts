import type { WebPreferences } from 'electron';
import type { ExportedConfig } from '@app-config/main';
import * as path from 'path';

export function addAppConfigPreload(config: ExportedConfig, baseWebPreferences?: WebPreferences) {
  let webPreferences: WebPreferences = {};

  if (baseWebPreferences) {
    webPreferences = baseWebPreferences;
  }

  const userPreload = baseWebPreferences?.preload;
  const userArguments = baseWebPreferences?.additionalArguments;

  const preloadArguments = userArguments || [];

  preloadArguments.push(`--app-config=${JSON.stringify(config)}`);

  if (userPreload) {
    preloadArguments.push(`--user-preload=${userPreload}`);
  }

  webPreferences.preload = path.join(__dirname, 'preloader.js');
  webPreferences.additionalArguments = preloadArguments;
  webPreferences.contextIsolation = true;

  return webPreferences;
}
