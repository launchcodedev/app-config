import { LiteralSource } from '@app-config/core';
import { forKey } from '@app-config/extension-utils';
import { envDirective } from './env-directive';

describe('$env directive', () => {
  it('fails when not in an environment', async () => {
    const source = new LiteralSource({ $env: {} });
    await expect(source.read([envDirective()])).rejects.toThrow();
  });

  it('fails when no options match current environment', async () => {
    process.env.NODE_ENV = 'test';
    const source = new LiteralSource({ $env: { dev: true } });
    await expect(source.read([envDirective()])).rejects.toThrow();
  });

  it('fails when options is not an object', async () => {
    const source = new LiteralSource({
      foo: {
        $env: 'invalid',
      },
    });

    await expect(source.read([envDirective()])).rejects.toThrow();
  });

  it('resolves to default environment', async () => {
    const source = new LiteralSource({ $env: { default: 42 } });
    const parsed = await source.read([envDirective()]);

    expect(parsed.toJSON()).toEqual(42);
  });

  it('fails to resolve with no current environment', async () => {
    process.env.NODE_ENV = undefined;

    const source = new LiteralSource({ $env: { test: 42 } });
    await expect(source.read([envDirective()])).rejects.toThrow();
  });

  it('resolves to default with no current environment', async () => {
    process.env.NODE_ENV = undefined;

    const source = new LiteralSource({ $env: { default: 42 } });

    expect(await source.readToJSON([envDirective()])).toBe(42);
  });

  it('resolves to test environment', async () => {
    process.env.NODE_ENV = 'test';
    const source = new LiteralSource({ $env: { test: 84, default: 42 } });
    const parsed = await source.read([envDirective()]);

    expect(parsed.toJSON()).toEqual(84);
  });

  it('resolves to environment alias', async () => {
    process.env.NODE_ENV = 'development';
    const source = new LiteralSource({ $env: { dev: 84, default: 42 } });
    const parsed = await source.read([envDirective()]);

    expect(parsed.toJSON()).toEqual(84);
  });

  it('uses environment alias', async () => {
    process.env.NODE_ENV = 'dev';
    const source = new LiteralSource({ $env: { development: 84, default: 42 } });
    const parsed = await source.read([envDirective()]);

    expect(parsed.toJSON()).toEqual(84);
  });

  it('resolves to object', async () => {
    process.env.NODE_ENV = 'test';
    const source = new LiteralSource({
      $env: { test: { testing: true }, default: { testing: false } },
    });

    const parsed = await source.read([envDirective()]);
    expect(parsed.toJSON()).toEqual({ testing: true });
  });

  it('resolves to null', async () => {
    process.env.NODE_ENV = 'test';
    const source = new LiteralSource({
      $env: { test: null },
    });

    const parsed = await source.read([envDirective()]);
    expect(parsed.toJSON()).toEqual(null);
  });

  it('uses the none option', async () => {
    delete process.env.NODE_ENV;
    const source = new LiteralSource({
      $env: { default: 1, none: 2 },
    });

    const parsed = await source.read([envDirective()]);
    expect(parsed.toJSON()).toEqual(2);
  });

  it('uses the default over the none option when env is defined', async () => {
    process.env.NODE_ENV = 'test';
    const source = new LiteralSource({
      $env: { default: 1, none: 2 },
    });

    const parsed = await source.read([envDirective()]);
    expect(parsed.toJSON()).toEqual(1);
  });

  it('doesnt evaluate non-current environment', async () => {
    const failDirective = forKey('$fail', () => () => {
      throw new Error();
    });

    process.env.NODE_ENV = 'test';
    const source = new LiteralSource({
      $env: { test: null, dev: { $fail: true } },
    });

    const parsed = await source.read([envDirective(), failDirective]);
    expect(parsed.toJSON()).toEqual(null);
  });

  it('merges selection with sibling keys', async () => {
    const source = new LiteralSource({
      sibling: true,
      testing: false,
      $env: {
        test: { testing: true },
        default: { testing: false },
      },
    });

    process.env.NODE_ENV = 'test';
    const parsed = await source.read([envDirective()]);
    expect(parsed.toJSON()).toEqual({ sibling: true, testing: true });

    process.env.NODE_ENV = 'development';
    const parsed2 = await source.read([envDirective()]);
    expect(parsed2.toJSON()).toEqual({ sibling: true, testing: false });
  });
});
