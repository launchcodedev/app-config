import { LiteralSource } from '@app-config/core';
import { forKey } from '@app-config/extension-utils';
import { substituteDirective } from './substitute-directive';

/* eslint-disable no-template-curly-in-string */
describe('$substitute directive', () => {
  it('fails with non-string values', async () => {
    const source = new LiteralSource({ $substitute: {} });
    await expect(source.read([substituteDirective()])).rejects.toThrow();
  });

  it('does simple environment variable substitution', async () => {
    process.env.FOO = 'foo';
    process.env.BAR = 'bar';

    const source = new LiteralSource({
      foo: { $substitute: '$FOO' },
      bar: { $substitute: '$BAR' },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo', bar: 'bar' });
  });

  it('uses $subs shorthand', async () => {
    process.env.FOO = 'bar';

    const source = new LiteralSource({
      foo: { $subs: '$FOO' },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'bar' });
  });

  it('does environment variable substitution fallback', async () => {
    const source = new LiteralSource({
      foo: { $substitute: '${FOO:-baz}' },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'baz' });
  });

  it('does environment variable substitution with empty value', async () => {
    process.env.FOO = '';

    const source = new LiteralSource({
      foo: { $substitute: '${FOO}' },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: '' });
  });

  it('does environment variable substitution with empty fallback', async () => {
    const source = new LiteralSource({
      foo: { $substitute: '${FOO:-}' },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: '' });
  });

  it('flows through nested substitution', async () => {
    process.env.BAR = 'qux';

    const source = new LiteralSource({
      foo: { $substitute: '${FOO:-${BAR}}' },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'qux' });
  });

  it('does variable substitutions mid-string', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $substitute: 'bar ${FOO} bar' },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'bar foo bar' });
  });

  it('does multiple variable substitutions', async () => {
    process.env.FOO = 'foo';
    process.env.BAR = 'bar';

    const source = new LiteralSource({
      foo: { $substitute: '${FOO} $BAR' },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo bar' });
  });

  it('does multiple variable substitutions with fallbacks', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $substitute: '${FOO} ${BAR:-bar}' },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo bar' });
  });

  it('does variable substitution in array', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: [{ $substitute: '${FOO}' }, 'bar'],
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: ['foo', 'bar'] });
  });

  it('reads special case variable $APP_CONFIG_ENV', async () => {
    process.env.NODE_ENV = 'qa';

    const source = new LiteralSource({
      foo: { $subs: '${APP_CONFIG_ENV}' },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'qa' });
  });

  it('reads special case name APP_CONFIG_ENV', async () => {
    process.env.NODE_ENV = 'qa';

    const source = new LiteralSource({
      foo: { $subs: { name: 'APP_CONFIG_ENV' } },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'qa' });
  });

  it('reads object with name', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $substitute: { name: 'FOO' } },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo' });
  });

  it('fails with name when not defined', async () => {
    const source = new LiteralSource({
      foo: { $substitute: { name: 'FOO' } },
    });

    await expect(source.read([substituteDirective()])).rejects.toThrow();
  });

  it('uses name when fallback is defined', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $substitute: { name: 'FOO', fallback: 'bar' } },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo' });
  });

  it('uses fallback when name was not found', async () => {
    const source = new LiteralSource({
      foo: { $substitute: { name: 'FOO', fallback: 'bar' } },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'bar' });
  });

  it('allows null value when allowNull', async () => {
    const source = new LiteralSource({
      foo: { $substitute: { name: 'FOO', fallback: null, allowNull: true } },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: null });
  });

  it('does not allow number even when allowNull', async () => {
    const source = new LiteralSource({
      foo: { $substitute: { name: 'FOO', fallback: 42, allowNull: true } },
    });

    await expect(source.read([substituteDirective()])).rejects.toThrow();
  });

  it('doesnt visit fallback if name is defined', async () => {
    const failDirective = forKey('$fail', () => () => {
      throw new Error();
    });

    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $substitute: { name: 'FOO', fallback: { $fail: true } } },
    });

    const parsed = await source.read([substituteDirective(), failDirective]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo' });
  });
});
