import { mkdirp } from 'fs-extra';
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

  it('loads a meta file from the workspace root', async () => {
    await withTempFiles(
      {
        '.app-config.meta.yml': `
          foo: bar
        `,
      },
      async (inDir) => {
        await mkdirp(inDir('.git'));
        await mkdirp(inDir('nested-folder/a/b/c'));

        const meta = await loadMetaConfig({ directory: inDir('nested-folder/a/b/c') });

        expect(meta.value).toEqual({ foo: 'bar' });
        expect(meta.filePath).toBe(inDir('.app-config.meta.yml'));
        expect(meta.fileType).toBe(FileType.YAML);
      },
    );
  });

  it('loads a meta file from a custom workspace root', async () => {
    await withTempFiles(
      {
        '.app-config.meta.yml': `
          foo: bar
        `,
      },
      async (inDir) => {
        await mkdirp(inDir('.svn'));
        await mkdirp(inDir('nested-folder/a/b/c'));

        const meta = await loadMetaConfig({
          lookForWorkspace: '.svn',
          directory: inDir('nested-folder/a/b/c'),
        });

        expect(meta.value).toEqual({ foo: 'bar' });
        expect(meta.filePath).toBe(inDir('.app-config.meta.yml'));
        expect(meta.fileType).toBe(FileType.YAML);
      },
    );
  });

  it('uses $extends in a meta file', async () => {
    await withTempFiles(
      {
        '.app-config.meta.yml': `
          foo: qux
          $extends: ./other-file.yml
        `,
        'other-file.yml': `
          foo: bar
          bar: baz
        `,
      },
      async (inDir) => {
        const meta = await loadMetaConfig({ directory: inDir('.') });

        expect(meta.value).toEqual({ foo: 'qux', bar: 'baz' });
        expect(meta.filePath).toBe(inDir('.app-config.meta.yml'));
        expect(meta.fileType).toBe(FileType.YAML);
      },
    );
  });

  it('uses $override in a meta file', async () => {
    await withTempFiles(
      {
        '.app-config.meta.yml': `
          foo: qux
          $override: ./other-file.yml
        `,
        'other-file.yml': `
          foo: bar
          bar: baz
        `,
      },
      async (inDir) => {
        const meta = await loadMetaConfig({ directory: inDir('.') });

        expect(meta.value).toEqual({ foo: 'bar', bar: 'baz' });
        expect(meta.filePath).toBe(inDir('.app-config.meta.yml'));
        expect(meta.fileType).toBe(FileType.YAML);
      },
    );
  });

  it('ignores meta file in workspace root when passed lookForWorkspace=false', async () => {
    await withTempFiles(
      {
        '.app-config.meta.yml': `
          foo: bar
        `,
      },
      async (inDir) => {
        await mkdirp(inDir('.git'));
        await mkdirp(inDir('nested-folder/a/b/c'));

        const meta = await loadMetaConfig({
          lookForWorkspace: false,
          directory: inDir('nested-folder/a/b/c'),
        });

        expect(meta.value).toEqual({});
        expect(meta.filePath).toBeUndefined();
        expect(meta.fileType).toBeUndefined();
      },
    );
  });

  it('loads a meta file from a nested folder in a workspace', async () => {
    await withTempFiles(
      {
        '.app-config.meta.yml': `
          foo: baz
        `,
        'a/b/c/.app-config.meta.yml': `
          foo: bar
        `,
      },
      async (inDir) => {
        await mkdirp(inDir('.git'));

        const meta = await loadMetaConfig({ directory: inDir('a/b/c') });

        expect(meta.value).toEqual({ foo: 'bar' });
        expect(meta.filePath).toBe(inDir('a/b/c/.app-config.meta.yml'));
        expect(meta.fileType).toBe(FileType.YAML);
      },
    );
  });
});
