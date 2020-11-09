import { loadConfig } from './config';
import { withTempFiles } from './test-util';

describe('Configuration Loading', () => {
  it('loads configuration', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `foo: 42`,
      },
      async (inDir) => {
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 42 });
      },
    );
  });
});

describe('V1 Compatibility', () => {
  it('uses special app-config property for $extends', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `
          app-config: { extends: "base-file.yml" }
          foo: 88
        `,
        'base-file.yml': `
          foo: 42
          bar: foo
        `,
      },
      async (inDir) => {
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 88, bar: 'foo' });
      },
    );
  });

  it('uses special app-config property for $extendsOptional', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `
          app-config: { extendsOptional: "base-file.yml" }
          foo: 88
        `,
        'base-file.yml': `
          foo: 42
          bar: foo
        `,
      },
      async (inDir) => {
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 88, bar: 'foo' });
      },
    );

    await withTempFiles(
      {
        '.app-config.yml': `
          app-config: { extendsOptional: "base-file.yml" }
          foo: 88
        `,
      },
      async (inDir) => {
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 88 });
      },
    );
  });

  it('uses special app-config property for $override', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `
          app-config: { override: "base-file.yml" }
          foo: 88
        `,
        'base-file.yml': `
          foo: 42
          bar: foo
        `,
      },
      async (inDir) => {
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 42, bar: 'foo' });
      },
    );
  });

  it('uses special app-config property for $overrideOptional', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `
          app-config: { overrideOptional: "base-file.yml" }
          foo: 88
        `,
        'base-file.yml': `
          foo: 42
          bar: foo
        `,
      },
      async (inDir) => {
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 42, bar: 'foo' });
      },
    );

    await withTempFiles(
      {
        '.app-config.yml': `
          app-config: { overrideOptional: "base-file.yml" }
          foo: 88
        `,
      },
      async (inDir) => {
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 88 });
      },
    );
  });
});
