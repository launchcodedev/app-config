import { WebPreferences } from 'electron';
import * as path from 'path';

export function addAppConfigPreload(baseWebPreferences?: WebPreferences) {
  let webPreferences: WebPreferences = {};

  if (baseWebPreferences) {
    webPreferences = baseWebPreferences;
  }

  const userPreload = baseWebPreferences?.preload;
  const userArguments = baseWebPreferences?.additionalArguments;

  if (userPreload) {
    const preloadArgument = `--user-preload=${userPreload}`;

    if (userArguments) {
      userArguments.push(preloadArgument);
    }

    webPreferences.additionalArguments = userArguments || [preloadArgument];
  }

  webPreferences.preload = path.join(__dirname, 'preloader.js');

  return webPreferences;
}
