import { loadConfig, loadValidatedConfig } from './config';
import { FileSource, EnvironmentSource } from './config-source';
import { ReservedKeyError } from './errors';
import { withTempFiles } from './test-util';

describe('Configuration Loading', () => {
  it('loads configuration from a YAML file', async () => {
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

  it('loads configuration from a TOML file', async () => {
    await withTempFiles(
      {
        '.app-config.toml': `foo = 42`,
      },
      async (inDir) => {
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 42 });
      },
    );
  });

  it('loads configuration from a JSON file', async () => {
    await withTempFiles(
      {
        '.app-config.json': `{ "foo": 42 }`,
      },
      async (inDir) => {
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 42 });
      },
    );
  });

  it('loads configuration from a JSON5 file', async () => {
    await withTempFiles(
      {
        '.app-config.json5': `{ foo: 42 }`,
      },
      async (inDir) => {
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 42 });
      },
    );
  });

  it('loads configuration from environment variable', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `foo: 42`,
      },
      async (inDir) => {
        process.env.APP_CONFIG = 'foo: 88';
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 88 });
      },
    );
  });

  it('loads environment specific configuration file', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `env: default`,
        '.app-config.dev.yml': `env: development`,
        '.app-config.production.yml': `env: production`,
      },
      async (inDir) => {
        expect((await loadConfig({ directory: inDir('.') })).fullConfig).toEqual({
          env: 'default',
        });

        process.env.NODE_ENV = 'development';
        expect((await loadConfig({ directory: inDir('.') })).fullConfig).toEqual({
          env: 'development',
        });

        process.env.NODE_ENV = 'production';
        expect((await loadConfig({ directory: inDir('.') })).fullConfig).toEqual({
          env: 'production',
        });
      },
    );
  });

  it('loads secrets configuration file', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `base: present`,
        '.app-config.secrets.yml': `secret: present`,
      },
      async (inDir) => {
        expect((await loadConfig({ directory: inDir('.') })).fullConfig).toEqual({
          base: 'present',
          secret: 'present',
        });
      },
    );
  });

  it('loads default values and merges them', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `
          a:
            b: true
          d: true
        `,
      },
      async (inDir) => {
        const { fullConfig, parsed } = await loadConfig({
          directory: inDir('.'),
          defaultValues: { a: { c: true }, e: true },
        });

        expect(parsed.sources.find((source) => source instanceof FileSource)).toBeTruthy();
        expect(fullConfig).toEqual({
          a: { b: true, c: true },
          d: true,
          e: true,
        });
      },
    );
  });

  it('loads default values and merges them with APP_CONFIG', async () => {
    process.env.APP_CONFIG = JSON.stringify({
      a: {
        b: true,
      },
      d: true,
    });

    const { fullConfig, parsed } = await loadConfig({ defaultValues: { a: { c: true }, e: true } });

    expect(parsed.sources.find((source) => source instanceof EnvironmentSource)).toBeTruthy();
    expect(fullConfig).toEqual({
      a: { b: true, c: true },
      d: true,
      e: true,
    });
  });

  it('takes default values into account in validation', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `
          a:
            b: true
          d: true
        `,

        '.app-config.schema.yml': `
          required: [a, d, e]
          additionalProperties: false
          properties:
            a:
              type: object
              additionalProperties:
                type: boolean
            d: { type: boolean }
            e: { type: boolean }
        `,
      },
      async (inDir) => {
        await expect(loadValidatedConfig({ directory: inDir('.') })).rejects.toThrow();
        await expect(
          loadValidatedConfig({ directory: inDir('.'), defaultValues: { d: 'string' } }),
        ).rejects.toThrow();

        const { fullConfig, parsed } = await loadValidatedConfig({
          directory: inDir('.'),
          defaultValues: { a: { c: true }, e: true },
        });

        expect(parsed.sources.find((source) => source instanceof FileSource)).toBeTruthy();
        expect(fullConfig).toEqual({
          a: { b: true, c: true },
          d: true,
          e: true,
        });
      },
    );
  });
});

describe('Configuration Loading Options', () => {
  it('uses environmentOverride', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `foo: default`,
        '.app-config.prod.yml': `foo: production`,
        '.app-config.development.yml': `
          foo:
            $substitute: '$APP_CONFIG_ENV'
          bar:
            $env:
              default: default
              dev: develop
        `,
      },
      async (inDir) => {
        expect((await loadConfig({ directory: inDir('.') })).fullConfig).toEqual({
          foo: 'default',
        });

        expect(
          (await loadConfig({ directory: inDir('.'), environmentOverride: 'production' }))
            .fullConfig,
        ).toEqual({ foo: 'production' });

        expect(
          (await loadConfig({ directory: inDir('.'), environmentOverride: 'development' }))
            .fullConfig,
        ).toEqual({
          foo: 'development',
          bar: 'develop',
        });
      },
    );
  });
});

describe('CI Environment Variable Extension', () => {
  it('merges APP_CONFIG_EXTEND values', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `foo: 42`,
      },
      async (inDir) => {
        process.env.APP_CONFIG_EXTEND = JSON.stringify({ bar: 88 });
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 42, bar: 88 });
      },
    );
  });

  it('merges APP_CONFIG_CI values', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `foo: 42`,
      },
      async (inDir) => {
        process.env.APP_CONFIG_CI = JSON.stringify({ bar: 88 });
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        expect(fullConfig).toEqual({ foo: 42, bar: 88 });
      },
    );
  });

  it('ignores APP_CONFIG_CI if overriden', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `foo: 42`,
      },
      async (inDir) => {
        process.env.APP_CONFIG_CI = JSON.stringify({ bar: 88 });
        const { fullConfig } = await loadConfig({
          directory: inDir('.'),
          extensionEnvironmentVariableNames: [],
        });

        expect(fullConfig).toEqual({ foo: 42 });
      },
    );
  });
});

describe('V1 Compatibility', () => {
  it('retains nested properties called app-config', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `
          nested:
            app-config:
              extends: base-file.yml
        `,
      },
      async (inDir) => {
        const { fullConfig } = await loadConfig({ directory: inDir('.') });

        // keeps config intact, since app-config isn't at the root
        expect(fullConfig).toEqual({ nested: { 'app-config': { extends: 'base-file.yml' } } });
      },
    );
  });

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

  it('uses an ambiguous path in special app-config property', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `
          app-config: { extends: "base-file" }
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
});

describe('Special values', () => {
  it('fails to loadConfig when a $ prefixed key is seen', async () => {
    process.env.APP_CONFIG = JSON.stringify({ a: { b: { $c: true } } });
    await expect(loadConfig()).rejects.toBeInstanceOf(ReservedKeyError);
  });

  it('loads config when an escaped $ key is seen', async () => {
    process.env.APP_CONFIG = JSON.stringify({ a: { b: { $$c: true } } });
    const { parsed } = await loadConfig();

    expect(parsed.property(['a', 'b'])!.toJSON()).toEqual({ $c: true });
    expect(parsed.property(['a', 'b', '$c'])!.toJSON()).toBe(true);
    expect(parsed.property(['a', 'b', '$c'])!.asPrimitive()).toBe(true);
    expect(parsed.property(['a', 'b', '$c'])!.meta).toMatchObject({ fromEscapedDirective: true });
  });

  it('unescapes $ keys when loading config from file', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `
          a:
            b:
              $$c: true
        `,
      },
      async (inDir) => {
        const { parsed } = await loadConfig({ directory: inDir('.') });

        expect(parsed.property(['a', 'b'])!.toJSON()).toEqual({ $c: true });
        expect(parsed.property(['a', 'b', '$c'])!.toJSON()).toBe(true);
        expect(parsed.property(['a', 'b', '$c'])!.asPrimitive()).toBe(true);
        expect(parsed.property(['a', 'b', '$c'])!.meta).toMatchObject({
          fromEscapedDirective: true,
        });
      },
    );
  });

  it('unescapes double $$ keys when loading config from file', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `
          a:
            b:
              $$$c: true
        `,
      },
      async (inDir) => {
        const { parsed } = await loadConfig({ directory: inDir('.') });

        expect(parsed.property(['a', 'b'])!.toJSON()).toEqual({ $$c: true });
        expect(parsed.property(['a', 'b', '$$c'])!.toJSON()).toBe(true);
        expect(parsed.property(['a', 'b', '$$c'])!.asPrimitive()).toBe(true);
        expect(parsed.property(['a', 'b', '$$c'])!.meta).toMatchObject({
          fromEscapedDirective: true,
        });
      },
    );
  });
});
