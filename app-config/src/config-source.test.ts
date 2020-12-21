import { EnvironmentSource, FileSource, FlexibleFileSource } from './config-source';
import { withTempFiles } from './test-util';

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
});

describe('EnvironmentSource', () => {
  it('fails when environment variable is missing', async () => {
    await expect(new EnvironmentSource('CONF').read()).rejects.toThrow();
  });

  it('reads a JSON environment variable', async () => {
    process.env.CONF = `{ "foo": true }`;
    const source = new EnvironmentSource('CONF');
    const parsed = await source.read();

    expect(parsed.sources[0]).toBe(source);
    expect(parsed.toJSON()).toEqual({ foo: true });
  });

  it('reads a YAML environment variable', async () => {
    process.env.CONF = `foo: bar`;
    const source = new EnvironmentSource('CONF');
    const parsed = await source.read();

    expect(parsed.sources[0]).toBe(source);
    expect(parsed.toJSON()).toEqual({ foo: 'bar' });
  });

  it('reads a TOML environment variable', async () => {
    process.env.CONF = `foo = "bar"`;
    const source = new EnvironmentSource('CONF');
    const parsed = await source.read();

    expect(parsed.sources[0]).toBe(source);
    expect(parsed.toJSON()).toEqual({ foo: 'bar' });
  });

  it('reads a JSON5 environment variable', async () => {
    process.env.CONF = `{ foo: "bar" }`;
    const source = new EnvironmentSource('CONF');
    const parsed = await source.read();

    expect(parsed.sources[0]).toBe(source);
    expect(parsed.toJSON()).toEqual({ foo: 'bar' });
  });
});
