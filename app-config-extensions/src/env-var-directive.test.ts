import { LiteralSource } from '@app-config/core';
import { forKey } from '@app-config/extension-utils';
import { envVarDirective } from './env-var-directive';

describe('$envVar directive', () => {
  it('fails with non-string values', async () => {
    const source = new LiteralSource({ $envVar: {} });
    await expect(source.read([envVarDirective()])).rejects.toThrow();
  });

  it('does simple environment variable substitution', async () => {
    process.env.FOO = 'foo';
    process.env.BAR = 'bar';

    const source = new LiteralSource({
      foo: { $envVar: 'FOO' },
      bar: { $envVar: 'BAR' },
    });

    const parsed = await source.read([envVarDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo', bar: 'bar' });
  });

  it('reads object with name', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO' } },
    });

    const parsed = await source.read([envVarDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo' });
  });

  it('fails with name when not defined', async () => {
    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO' } },
    });

    await expect(source.read([envVarDirective()])).rejects.toThrow();
  });

  it('uses name when fallback is defined', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO', fallback: 'bar' } },
    });

    const parsed = await source.read([envVarDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo' });
  });

  it('uses fallback when name was not found', async () => {
    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO', fallback: 'bar' } },
    });

    const parsed = await source.read([envVarDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'bar' });
  });

  it('allows null value when allowNull', async () => {
    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO', fallback: null, allowNull: true } },
    });

    const parsed = await source.read([envVarDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: null });
  });

  it('does not allow number even when allowNull', async () => {
    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO', fallback: 42, allowNull: true } },
    });

    await expect(source.read([envVarDirective()])).rejects.toThrow();
  });

  it('returns null when allowMissing', async () => {
    process.env.BAR = 'foo';

    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO', allowMissing: true } },
      bar: { $envVar: { name: 'BAR', allowMissing: true } },
    });

    const parsed = await source.read([envVarDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: null, bar: 'foo' });
  });

  it('doesnt visit fallback if name is defined', async () => {
    const failDirective = forKey('$fail', () => () => {
      throw new Error();
    });

    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO', fallback: { fail: true } } },
    });

    const parsed = await source.read([envVarDirective(), failDirective]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo' });
  });

  it('reads special case name APP_CONFIG_ENV', async () => {
    process.env.NODE_ENV = 'qa';

    const source = new LiteralSource({
      foo: { $envVar: { name: 'APP_CONFIG_ENV' } },
    });

    const parsed = await source.read([envVarDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'qa' });
  });
});
