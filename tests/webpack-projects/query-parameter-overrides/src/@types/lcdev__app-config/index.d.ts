// AUTO GENERATED CODE
// Run app-config with 'generate' command to regenerate this file

import '@lcdev/app-config';

export interface Config {
  longStringProperty: string;
  urlProperty: string;
}

// augment the default export from app-config
declare module '@lcdev/app-config' {
  export interface ExportedConfig extends Config {}
}
