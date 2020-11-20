import { FileType } from './config-source';
import { loadMetaConfig } from './meta';
import { withTempFiles } from './test-util';

describe('meta file loading', () => {
  it('gracefully fails when meta file is missing', async () => {
    const meta = await loadMetaConfig();

    expect(meta.value).toEqual({});
    expect(meta.filePath).toBeUndefined();
    expect(meta.fileType).toBeUndefined();
  });

  it('loads a simple meta file', async () => {
    await withTempFiles(
      {
        '.app-config.meta.yml': `
          foo: bar
        `,
      },
      async (inDir) => {
        const meta = await loadMetaConfig({ directory: inDir('.') });

        expect(meta.value).toEqual({ foo: 'bar' });
        expect(meta.filePath).toBe(inDir('.app-config.meta.yml'));
        expect(meta.fileType).toBe(FileType.YAML);
      },
    );
  });
});
