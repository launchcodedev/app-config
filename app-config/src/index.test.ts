import { inspect } from 'util';
import { withTempFiles } from '@app-config/test-utils';
import { config, loadConfig, mockConfig, resetConfigInternal } from './index';

beforeEach(() => resetConfigInternal());

describe('loadConfig', () => {
  it('throws an error when accessing config before loadConfig is called', () => {
    expect(() => {
      const { foo: _ } = config as { foo?: void };
    }).toThrow();
  });

  it('loads configuration', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `foo: 42`,
        '.app-config.schema.yml': `type: object`,
      },
      async (inDir) => {
        const loaded = await loadConfig({ directory: inDir('.') });

        expect(loaded).toEqual(config);
        expect(loaded).toEqual({ foo: 42 });
        expect({ ...loaded }).toEqual(loaded);
        expect(Object.keys(loaded)).toEqual(['foo']);
        expect(JSON.stringify(loaded)).toEqual(JSON.stringify({ foo: 42 }));
      },
    );
  });

  it('calls toJSON correctly', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `foo: 42`,
        '.app-config.schema.yml': `type: object`,
      },
      async (inDir) => {
        const loaded = await loadConfig({ directory: inDir('.') });

        expect(inspect(loaded)).toEqual(inspect({ foo: 42 }));
      },
    );
  });

  it('allows deep property access', async () => {
    await withTempFiles(
      {
        '.app-config.yml': `foo: { bar: { baz: 88 } }`,
        '.app-config.schema.yml': `type: object`,
      },
      async (inDir) => {
        const loaded = (await loadConfig({
          directory: inDir('.'),
        })) as { foo: { bar: { baz: number } } };

        expect(loaded.foo.bar).toEqual({ baz: 88 });
        expect(loaded.foo.bar.baz).toEqual(88);
      },
    );
  });

  it('lists root level keys correctly', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `type: object`,
        '.app-config.yml': `
          a: true
          b: true
          c: true
        `,
      },
      async (inDir) => {
        const loaded = (await loadConfig({
          directory: inDir('.'),
        })) as { a: boolean; b: boolean; c: boolean };

        expect(Object.keys(loaded)).toEqual(['a', 'b', 'c']);
      },
    );
  });

  it("responds to 'in' operator", async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `type: object`,
        '.app-config.yml': `
          a: true
          b: true
          c: true
        `,
      },
      async (inDir) => {
        const loaded = (await loadConfig({
          directory: inDir('.'),
        })) as { a: boolean; b: boolean; c: boolean };

        expect('a' in loaded).toBe(true);
        expect('b' in loaded).toBe(true);
        expect('c' in loaded).toBe(true);
      },
    );
  });

  it('disallows property deletion or mutation', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `type: object`,
        '.app-config.yml': `foo: 88`,
      },
      async (inDir) => {
        const loaded = (await loadConfig({
          directory: inDir('.'),
        })) as { foo?: number };

        expect(() => {
          delete loaded.foo;
        }).toThrow();
        expect(() => {
          loaded.foo = 99;
        }).toThrow();
        expect(() => {
          loaded.foo = undefined;
        }).toThrow();
      },
    );
  });

  it('disallows defineProperty', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `type: object`,
        '.app-config.yml': `foo: 88`,
      },
      async (inDir) => {
        const loaded = await loadConfig({ directory: inDir('.') });

        expect(() => {
          Object.defineProperty(loaded, 'foo', { value: 99 });
        }).toThrow();
      },
    );
  });
});

describe('mockConfig', () => {
  it('mocks out the config expert', async () => {
    mockConfig({ foo: 'bar' });
    expect(config).toEqual({ foo: 'bar' });
    await expect(() => loadConfig()).rejects.toThrow();
  });
});
