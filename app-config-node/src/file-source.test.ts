import { withTempFiles } from '@app-config/test-utils';
import { FileSource, FlexibleFileSource } from './file-source';

describe('FileSource', () => {
  it('fails when file doesnt exist', async () => {
    await expect(new FileSource('test-file.json').read()).rejects.toThrow();
  });

  it('reads an empty JSON file', async () => {
    await withTempFiles(
      {
        'test-file.json': `{}`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read();

        expect(parsed.sources[0]).toBe(source);
        expect(parsed.raw).toEqual({});
        expect(parsed.toJSON()).toEqual({});
        expect(parsed.toString()).toEqual('{}');
      },
    );
  });

  it('reads a simple JSON file', async () => {
    await withTempFiles(
      {
        'test-file.json': `{ "foo": true }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read();

        expect(parsed.sources[0]).toBe(source);
        expect(parsed.raw).toEqual({ foo: true });
        expect(parsed.toJSON()).toEqual({ foo: true });
        expect(parsed.toString()).toEqual('{"foo":true}');
      },
    );
  });
});

describe('FlexibleFileSource', () => {
  it('loads simple yaml app-config file', async () => {
    await withTempFiles(
      {
        'app-config.yml': `
          foo: bar
        `,
      },
      async (inDir) => {
        const source = new FlexibleFileSource(inDir('app-config'));
        const parsed = await source.read();

        expect(parsed.toJSON()).toEqual({ foo: 'bar' });
      },
    );
  });

  it('loads simple json app-config file', async () => {
    await withTempFiles(
      {
        'app-config.json': `{"foo": "bar"}`,
      },
      async (inDir) => {
        const source = new FlexibleFileSource(inDir('app-config'));
        const parsed = await source.read();

        expect(parsed.toJSON()).toEqual({ foo: 'bar' });
      },
    );
  });

  it('loads simple json5 app-config file', async () => {
    await withTempFiles(
      {
        'app-config.json5': `{foo: "bar"}`,
      },
      async (inDir) => {
        const source = new FlexibleFileSource(inDir('app-config'));
        const parsed = await source.read();

        expect(parsed.toJSON()).toEqual({ foo: 'bar' });
      },
    );
  });

  it('loads simple toml app-config file', async () => {
    await withTempFiles(
      {
        'app-config.toml': `
          foo = "bar"
        `,
      },
      async (inDir) => {
        const source = new FlexibleFileSource(inDir('app-config'));
        const parsed = await source.read();

        expect(parsed.toJSON()).toEqual({ foo: 'bar' });
      },
    );
  });

  it('loads app-config file with environment name', async () => {
    await withTempFiles(
      {
        'app-config.production.yml': `
          foo: bar
        `,
      },
      async (inDir) => {
        process.env.APP_CONFIG_ENV = 'production';
        const source = new FlexibleFileSource(inDir('app-config'));
        const parsed = await source.read();

        expect(parsed.toJSON()).toEqual({ foo: 'bar' });
      },
    );
  });

  it('loads app-config file with environment alias', async () => {
    await withTempFiles(
      {
        'app-config.prod.yml': `
          foo: bar
        `,
      },
      async (inDir) => {
        process.env.APP_CONFIG_ENV = 'production';
        const source = new FlexibleFileSource(inDir('app-config'));
        const parsed = await source.read();

        expect(parsed.toJSON()).toEqual({ foo: 'bar' });
      },
    );
  });

  it('loads using readContents correctly', async () => {
    await withTempFiles(
      {
        'app-config.yml': `
          foo: bar
        `,
      },
      async (inDir) => {
        const source = new FlexibleFileSource(inDir('app-config'));
        const [text, fileType] = await source.readContents();

        expect([text, fileType]).toMatchSnapshot();
      },
    );
  });
});
