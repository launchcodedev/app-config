import { join } from 'path';
import { FlexibleFileSource, FileSource, FileType } from './config-source';
import { EncryptedSymmetricKey } from './encryption';
import { NotFoundError } from './errors';
import { GenerateFile } from './generate';
import { logger } from './logging';

export interface Options {
  directory?: string;
  fileNameBase?: string;
}

export interface TeamMember {
  userId: string;
  publicKey: string;
}

export interface MetaProperties {
  teamMembers?: TeamMember[];
  encryptionKeys?: EncryptedSymmetricKey[];
  generate?: GenerateFile[];
}

export interface MetaConfiguration {
  filePath?: string;
  fileType?: FileType;
  value: MetaProperties;
}

export async function loadMetaConfig({
  directory = '.',
  fileNameBase = '.app-config.meta',
}: Options = {}): Promise<MetaConfiguration> {
  const source = new FlexibleFileSource(join(directory, fileNameBase));

  try {
    const parsed = await source.read();
    const value = parsed.toJSON() as MetaProperties;
    const { filePath, fileType } = parsed.source as FileSource;

    logger.verbose(`Meta file was loaded from ${filePath}`);

    return {
      filePath,
      fileType,
      value,
    };
  } catch (error) {
    if (error instanceof NotFoundError) return { value: {} };

    throw error;
  }
}

let metaConfig: Promise<MetaConfiguration> | undefined;

export async function loadMetaConfigLazy(options?: Options): Promise<MetaConfiguration> {
  if (!metaConfig) {
    metaConfig = loadMetaConfig(options);
  }

  return metaConfig;
}
