import { FlexibleFileSource, FileSource, FileType } from './config-source';
import { EncryptedSymmetricKey } from './encryption';
import { NotFoundError } from './errors';
import { GenerateFile } from './generate';

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

export async function loadMetaConfig(fileName = '.app-config.meta'): Promise<MetaConfiguration> {
  const source = new FlexibleFileSource(fileName);

  try {
    const parsed = await source.read();
    const value = parsed.toJSON() as MetaProperties;
    const { filePath, fileType } = parsed.source as FileSource;

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

export async function loadMetaConfigLazy(): Promise<MetaConfiguration> {
  if (!metaConfig) {
    metaConfig = loadMetaConfig();
  }

  return metaConfig;
}
