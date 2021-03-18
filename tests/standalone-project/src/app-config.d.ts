// AUTO GENERATED CODE
// Run app-config with 'generate' command to regenerate this file

import '@app-config/main';

export interface Config {
  propA: string;
}

// augment the default export from app-config
declare module '@app-config/main' {
  export interface ExportedConfig extends Config {}
}
