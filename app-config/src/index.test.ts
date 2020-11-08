import { config, loadConfig, resetConfigInternal } from './index';
import { withTempFiles } from './test-util';

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

  it('deep property access', async () => {
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
});
