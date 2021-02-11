// AUTO GENERATED CODE
// Run app-config with 'generate' command to regenerate this file

import '@app-config/main';

export interface Index {
  database: Database;
  port: number;
}

export interface Database {
  database: string;
  password: string;
  port: number;
  username: string;
}

// augment the default export from app-config
declare module '@app-config/main' {
  export interface ExportedConfig extends Index {}
}
