import { EnvironmentSource } from './environment-source';

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
