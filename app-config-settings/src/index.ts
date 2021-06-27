import { join, resolve } from 'path';
import { homedir } from 'os';
import * as fs from 'fs-extra';
import envPaths from 'env-paths';
import { JsonObject } from '@app-config/utils';
import { stringify, FileType, NotFoundError } from '@app-config/core';
import { logger } from '@app-config/logging';
import { FileSource } from '@app-config/node';

export interface Settings {
  secretAgent?: {
    key: string;
    cert: string;
    expiry: string;
    port?: number;
    socket?: string;
  };
}

export function settingsDirectory() {
  if (process.env.APP_CONFIG_SETTINGS_FOLDER) {
    return resolve(process.env.APP_CONFIG_SETTINGS_FOLDER);
  }

  const oldConfigDir = join(homedir(), '.app-config');
  const { config: configDir } = envPaths('app-config', { suffix: '' });

  if (fs.pathExistsSync(oldConfigDir)) {
    logger.warn(`Moving ${oldConfigDir} to ${configDir}`);
    fs.moveSync(oldConfigDir, configDir);
  }

  return configDir;
}

export async function loadSettings(): Promise<Settings> {
  const path = join(settingsDirectory(), 'settings.yml');
  const source = new FileSource(path);

  logger.verbose(`Loading settings from ${path}`);

  try {
    const parsed = await source.read();
    const value = parsed.toJSON() as Settings;

    return value;
  } catch (error) {
    if (NotFoundError.isNotFoundError(error, path)) {
      return {};
    }

    throw error;
  }
}

export async function saveSettings(newSettings: Settings) {
  settings = Promise.resolve(newSettings);

  const path = join(settingsDirectory(), 'settings.yml');
  const stringified = stringify(newSettings as JsonObject, FileType.YAML);

  logger.verbose(`Saving settings to ${path}`);

  await fs.outputFile(path, stringified);
}

let settings: Promise<Settings> | undefined;

export async function loadSettingsLazy(): Promise<Settings> {
  if (!settings) {
    settings = loadSettings();
  }

  return settings;
}
