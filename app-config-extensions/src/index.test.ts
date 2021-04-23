import { withTempFiles } from '@app-config/test-utils';
import { LiteralSource, NotFoundError, Fallbackable } from '@app-config/core';
import { FileSource } from '@app-config/node';
import { forKey } from '@app-config/extension-utils';
import {
  tryDirective,
  ifDirective,
  eqDirective,
  hiddenDirective,
  envDirective,
  envVarDirective,
  extendsDirective,
  extendsSelfDirective,
  overrideDirective,
  timestampDirective,
  substituteDirective,
} from './index';

describe('$try directive', () => {
  it('uses main value', async () => {
    const source = new LiteralSource({
      $try: {
        $value: 'foobar',
        $fallback: 'barfoo',
      },
    });

    expect(await source.readToJSON([tryDirective()])).toEqual('foobar');
  });

  it('uses fallback value', async () => {
    const failDirective = forKey('$fail', () => () => {
      throw new Fallbackable();
    });

    const source = new LiteralSource({
      $try: {
        $value: {
          $fail: true,
        },
        $fallback: 'barfoo',
      },
    });

    expect(await source.readToJSON([tryDirective(), failDirective])).toEqual('barfoo');
  });

  it('doesnt evaluate fallback if value works', async () => {
    const failDirective = forKey('$fail', () => () => {
      throw new Fallbackable();
    });

    const source = new LiteralSource({
      $try: {
        $value: 'barfoo',
        $fallback: {
          $fail: true,
        },
      },
    });

    expect(await source.readToJSON([tryDirective(), failDirective])).toEqual('barfoo');
  });

  it('doesnt swallow plain errors', async () => {
    const failDirective = forKey('$fail', () => () => {
      throw new Error();
    });

    const source = new LiteralSource({
      $try: {
        $value: {
          $fail: true,
        },
        $fallback: 'barfoo',
      },
    });

    await expect(source.readToJSON([tryDirective(), failDirective])).rejects.toThrow(Error);
  });

  it('swallows plain errors with "unsafe" option', async () => {
    const failDirective = forKey('$fail', () => () => {
      throw new Error();
    });

    const source = new LiteralSource({
      $try: {
        $value: {
          $fail: true,
        },
        $fallback: 'barfoo',
        $unsafe: true,
      },
    });

    expect(await source.readToJSON([tryDirective(), failDirective])).toEqual('barfoo');
  });
});

describe('$if directive', () => {
  it('uses main value', async () => {
    const source = new LiteralSource({
      $if: {
        $check: true,
        $then: 'foobar',
        $else: 'barfoo',
      },
    });

    expect(await source.readToJSON([ifDirective()])).toEqual('foobar');
  });

  it('uses fallback value', async () => {
    const source = new LiteralSource({
      $if: {
        $check: false,
        $then: 'foobar',
        $else: 'barfoo',
      },
    });

    expect(await source.readToJSON([ifDirective()])).toEqual('barfoo');
  });

  it('doesnt evaluate the else branch', async () => {
    const source = new LiteralSource({
      $if: {
        $check: true,
        $then: 'barfoo',
        $else: {
          $fail: true,
        },
      },
    });

    expect(await source.readToJSON([ifDirective()])).toEqual('barfoo');
  });

  it('doesnt evaluate the other branch', async () => {
    const source = new LiteralSource({
      $if: {
        $check: false,
        $then: {
          $fail: true,
        },
        $else: 'barfoo',
      },
    });

    expect(await source.readToJSON([ifDirective()])).toEqual('barfoo');
  });

  it('disallows missing property', async () => {
    const source = new LiteralSource({
      $if: {
        $check: false,
        $else: 'barfoo',
      },
    });

    await expect(source.readToJSON([ifDirective()])).rejects.toThrow();
  });

  it('parses $check', async () => {
    const source = new LiteralSource({
      $if: {
        $check: {
          $env: {
            default: true,
          },
        },
        $then: 'foobar',
        $else: 'barfoo',
      },
    });

    expect(await source.readToJSON([ifDirective(), envDirective()])).toEqual('foobar');
  });
});

describe('$eq directive', () => {
  it('returns true for empty', async () => {
    const source = new LiteralSource({
      $eq: [],
    });

    expect(await source.readToJSON([eqDirective()])).toBe(true);
  });

  it('returns true for two numbers', async () => {
    const source = new LiteralSource({
      $eq: [42, 42],
    });

    expect(await source.readToJSON([eqDirective()])).toBe(true);
  });

  it('returns false for two numbers', async () => {
    const source = new LiteralSource({
      $eq: [42, 44],
    });

    expect(await source.readToJSON([eqDirective()])).toBe(false);
  });

  it('returns true for two objects', async () => {
    const source = new LiteralSource({
      $eq: [{ a: true }, { a: true }],
    });

    expect(await source.readToJSON([eqDirective()])).toBe(true);
  });

  it('returns false for two objects', async () => {
    const source = new LiteralSource({
      $eq: [{ a: true }, { b: true }],
    });

    expect(await source.readToJSON([eqDirective()])).toBe(false);
  });

  it('parses before checking equality', async () => {
    process.env.APP_CONFIG_ENV = 'test';
    const source = new LiteralSource({
      $eq: [{ $env: { default: { a: true } } }, { $env: { test: { a: true } } }],
    });

    expect(await source.readToJSON([eqDirective(), envDirective()])).toBe(true);
  });
});

describe('$hidden directive', () => {
  it('doesnt include hidden', async () => {
    const source = new LiteralSource({
      $hidden: {},
    });

    expect(await source.readToJSON([hiddenDirective()])).toEqual({});
  });

  it('merges hidden', async () => {
    const source = new LiteralSource({
      $hidden: {},
      foo: true,
    });

    expect(await source.readToJSON([hiddenDirective()])).toEqual({ foo: true });
  });

  it('references hidden property', async () => {
    const source = new LiteralSource({
      $hidden: {
        foo: 42,
      },
      baz: {
        $hidden: 44,
      },
      foo: {
        $extendsSelf: '$hidden.foo',
      },
      bar: {
        $extendsSelf: 'baz.$hidden',
      },
    });

    expect(await source.readToJSON([extendsSelfDirective(), hiddenDirective()])).toEqual({
      baz: {},
      foo: 42,
      bar: 44,
    });
  });

  it('references hidden property and processes it', async () => {
    process.env.FOO = 'bar';

    const source = new LiteralSource({
      $hidden: {
        foo: {
          $envVar: 'FOO',
        },
      },
      foo: {
        $extendsSelf: '$hidden.foo',
      },
    });

    expect(
      await source.readToJSON([extendsSelfDirective(), hiddenDirective(), envVarDirective()]),
    ).toEqual({
      foo: 'bar',
    });
  });
});

describe('$extends directive', () => {
  it('fails if file is missing', async () => {
    const source = new LiteralSource({
      $extends: './test-file.json',
    });

    await expect(source.read([extendsDirective()])).rejects.toBeInstanceOf(NotFoundError);
  });

  it('merges in file at top level', async () => {
    await withTempFiles(
      {
        'test-file.json': `{ "foo": true }`,
      },
      async (inDir) => {
        const source = new LiteralSource({
          $extends: inDir('test-file.json'),
        });

        const parsed = await source.read([extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true });
      },
    );
  });

  it('merges two files', async () => {
    await withTempFiles(
      {
        'referenced-file.json': `{ "foo": true }`,
        'test-file.json': `{ "$extends": "./referenced-file.json", "bar": true }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read([extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true, bar: true });
      },
    );
  });

  it('merges many files (flat)', async () => {
    await withTempFiles(
      {
        'referenced-file-1.json': `{ "foo": true }`,
        'referenced-file-2.json': `{ "bar": true }`,
        'referenced-file-3.json': `{ "baz": true }`,

        'test-file.json': `{
          "qux": true,
          "$extends": [
            "./referenced-file-1.json",
            "./referenced-file-2.json",
            "./referenced-file-3.json"
          ]
        }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read([extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true, bar: true, baz: true, qux: true });
      },
    );
  });

  it('merges many files (recursive)', async () => {
    await withTempFiles(
      {
        'referenced-file-3.json': `{ "qux": true, "foo": false }`,
        'referenced-file-2.json': `{ "$extends": "./referenced-file-3.json", "baz": true }`,
        'referenced-file.json': `{ "$extends": "./referenced-file-2.json", "bar": true }`,
        'test-file.json': `{ "$extends": "./referenced-file.json", "foo": true }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read([extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true, bar: true, baz: true, qux: true });
      },
    );
  });

  it('reference filepaths are treated relative to cwd of files', async () => {
    await withTempFiles(
      {
        'foo/bar/referenced-file-3.json': `{ "qux": true }`,
        'foo/referenced-file-2.json': `{ "$extends": "./bar/referenced-file-3.json", "baz": true }`,
        'foo/referenced-file.json': `{ "$extends": "./referenced-file-2.json", "bar": true }`,
        'test-file.json': `{ "$extends": "./foo/referenced-file.json", "foo": true }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read([extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true, bar: true, baz: true, qux: true });
      },
    );
  });

  it('relative filepaths in complex tree structure', async () => {
    await withTempFiles(
      {
        'bar/ref.json5': `{
          bar: true,
        }`,
        'baz/ref.json5': `{
          baz: true,
        }`,
        'foo/ref.json5': `{
          foo: true,
          // ref.json5
          $extends: "../ref.json5",
          bar: {
            // bar/ref.json5
            $extends: "../bar/ref.json5",
          },
        }`,
        'ref.json5': `{
          baz: {
            // baz/ref.json5
            $extends: "./baz/ref.json5",
          },
        }`,
        'test-file.json5': `{
          root: true,
          $extends: "./foo/ref.json5",
        }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json5'));
        const parsed = await source.read([extendsDirective()]);

        expect(parsed.toJSON()).toEqual({
          root: true,
          // foo/ref.json5
          foo: true,
          // foo/ref.json5 -> ../ref.json5 -> baz
          baz: {
            // baz/ref.json5
            baz: true,
          },
          bar: {
            // bar/ref.json5
            bar: true,
          },
        });
      },
    );
  });

  it('merges two files with an override', async () => {
    await withTempFiles(
      {
        'referenced-file.json': `{ "foo": true, "bar": true }`,
        'test-file.json': `{ "$extends": "./referenced-file.json", "bar": false }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read([extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true, bar: false });
      },
    );
  });

  it('supports object notation', async () => {
    await withTempFiles(
      {
        'referenced-file.json': `{ "foo": true }`,
        'test-file.json': `{
          "$extends": { "path": "./referenced-file.json" },
          "bar": false
        }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read([extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true, bar: false });
      },
    );
  });

  it('allows optional extending files', async () => {
    await withTempFiles(
      {
        'test-file.json': `{
          "$extends": { "path": "./referenced-file.json", "optional": true },
          "foo": true
        }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read([extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true });
      },
    );
  });

  it('selects specific properties', async () => {
    await withTempFiles(
      {
        'referenced-file.json': `{ "foo": { "bar": { "baz": true } } }`,
        'test-file.json': `{
          "$extends": { "path": "./referenced-file.json", "select": "foo.bar" },
          "foo": true
        }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read([extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true, baz: true });
      },
    );
  });

  it('selects a non-object property', async () => {
    await withTempFiles(
      {
        'referenced-file.json': `{ "foo": 42, "bar": { "a": true, "b": true } }`,
        'test-file.yaml': `
          foo:
            $extends:
              path: ./referenced-file.json
              select: 'bar'
          bar:
            $extends:
              path: ./referenced-file.json
              select: 'foo'
        `,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.yaml'));
        const parsed = await source.read([extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: { a: true, b: true }, bar: 42 });
      },
    );
  });
});

describe('$override directive', () => {
  it('fails if file is missing', async () => {
    const source = new LiteralSource({
      $override: './test-file.json',
    });

    await expect(source.read([overrideDirective()])).rejects.toBeInstanceOf(NotFoundError);
  });

  it('merges two files', async () => {
    await withTempFiles(
      {
        'referenced-file.json': `{ "foo": true }`,
        'test-file.json': `{ "$override": "./referenced-file.json", "bar": true }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read([overrideDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true, bar: true });
      },
    );
  });

  it('merges two files with an override', async () => {
    await withTempFiles(
      {
        'referenced-file.json': `{ "foo": true, "bar": true }`,
        'test-file.json': `{ "$override": "./referenced-file.json", "bar": false }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read([overrideDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true, bar: true });
      },
    );
  });

  it('merges many files (recursive)', async () => {
    await withTempFiles(
      {
        'referenced-file-3.json': `{ "qux": true, "foo": false }`,
        'referenced-file-2.json': `{ "$override": "./referenced-file-3.json", "baz": true }`,
        'referenced-file.json': `{ "$override": "./referenced-file-2.json", "bar": true }`,
        'test-file.json': `{ "$override": "./referenced-file.json", "foo": true, "bar": false, "baz": false }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read([overrideDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: false, bar: true, baz: true, qux: true });
      },
    );
  });

  it('merges many files (flat)', async () => {
    await withTempFiles(
      {
        'referenced-file-1.json': `{ "foo": true }`,
        'referenced-file-2.json': `{ "bar": true }`,
        'referenced-file-3.json': `{ "baz": true }`,

        'test-file.json': `{
          "qux": true,
          "$override": [
            "./referenced-file-1.json",
            "./referenced-file-2.json",
            "./referenced-file-3.json"
          ]
        }`,
      },
      async (inDir) => {
        const source = new FileSource(inDir('test-file.json'));
        const parsed = await source.read([overrideDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true, bar: true, baz: true, qux: true });
      },
    );
  });
});

describe('$extendsSelf directive', () => {
  it('fails when $extendsSelf selector is invalid', async () => {
    const source = new LiteralSource({
      foo: {
        $extendsSelf: 'foo.bar',
      },
    });

    await expect(source.read([extendsSelfDirective()])).rejects.toThrow();
  });

  it('fails when $extendsSelf selector is not a string', async () => {
    const source = new LiteralSource({
      foo: {
        $extendsSelf: {},
      },
    });

    await expect(source.read([extendsSelfDirective()])).rejects.toThrow();
  });

  it('resolves a simple $extendsSelf selector', async () => {
    const source = new LiteralSource({
      foo: {
        bar: {
          baz: 42,
        },
      },
      qux: {
        $extendsSelf: 'foo.bar',
      },
    });

    const parsed = await source.read([extendsSelfDirective()]);
    expect(parsed.toJSON()).toEqual({
      foo: { bar: { baz: 42 } },
      qux: { baz: 42 },
    });
  });

  it('resolves a $extendsSelf selector to a literal value', async () => {
    const source = new LiteralSource({
      foo: {
        bar: {
          baz: 42,
        },
      },
      qux: {
        $extendsSelf: 'foo.bar.baz',
      },
    });

    const parsed = await source.read([extendsSelfDirective()]);
    expect(parsed.toJSON()).toEqual({
      foo: { bar: { baz: 42 } },
      qux: 42,
    });
  });

  it('resolves an $extends selector to own file', async () => {
    await withTempFiles(
      {
        'test-file.yaml': `
          foo:
            bar:
              baz: 42

          qux:
            $extends:
              path: './test-file.yaml'
              selector: '.foo.bar'
        `,
      },
      async (inDir) => {
        const source = new LiteralSource({
          $extends: inDir('test-file.yaml'),
        });

        await expect(source.read([extendsDirective()])).rejects.toThrow();
      },
    );
  });
});

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

  it('reads object with $name', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $substitute: { $name: 'FOO' } },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo' });
  });

  it('fails with $name when not defined', async () => {
    const source = new LiteralSource({
      foo: { $substitute: { $name: 'FOO' } },
    });

    await expect(source.read([substituteDirective()])).rejects.toThrow();
  });

  it('uses $name when $fallback is defined', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $substitute: { $name: 'FOO', $fallback: 'bar' } },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo' });
  });

  it('uses $fallback when $name was not found', async () => {
    const source = new LiteralSource({
      foo: { $substitute: { $name: 'FOO', $fallback: 'bar' } },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'bar' });
  });

  it('allows null value when $allowNull', async () => {
    const source = new LiteralSource({
      foo: { $substitute: { $name: 'FOO', $fallback: null, $allowNull: true } },
    });

    const parsed = await source.read([substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: null });
  });

  it('does not allow number even when $allowNull', async () => {
    const source = new LiteralSource({
      foo: { $substitute: { $name: 'FOO', $fallback: 42, $allowNull: true } },
    });

    await expect(source.read([substituteDirective()])).rejects.toThrow();
  });

  it('parses ints', async () => {
    process.env.FOO = '11';

    const source = new LiteralSource({
      $substitute: { $name: 'FOO', $parseInt: true },
    });

    expect(await source.readToJSON([substituteDirective()])).toEqual(11);
  });

  it('fails when int is invalid', async () => {
    process.env.FOO = 'not a number';

    const source = new LiteralSource({
      $substitute: { $name: 'FOO', $parseInt: true },
    });

    await expect(source.read([substituteDirective()])).rejects.toThrow();
  });

  it('parses float', async () => {
    process.env.FOO = '11.2';

    const source = new LiteralSource({
      $substitute: { $name: 'FOO', $parseFloat: true },
    });

    expect(await source.readToJSON([substituteDirective()])).toEqual(11.2);
  });

  it('fails when float is invalid', async () => {
    process.env.FOO = 'not a number';

    const source = new LiteralSource({
      $substitute: { $name: 'FOO', $parseFloat: true },
    });

    await expect(source.read([substituteDirective()])).rejects.toThrow();
  });

  it('parses boolean = true', async () => {
    process.env.FOO = 'true';

    const source = new LiteralSource({
      $substitute: { $name: 'FOO', $parseBool: true },
    });

    expect(await source.readToJSON([substituteDirective()])).toEqual(true);
  });

  it('parses boolean = 1', async () => {
    process.env.FOO = '1';

    const source = new LiteralSource({
      $substitute: { $name: 'FOO', $parseBool: true },
    });

    expect(await source.readToJSON([substituteDirective()])).toEqual(true);
  });

  it('parses boolean = 0', async () => {
    process.env.FOO = '0';

    const source = new LiteralSource({
      $substitute: { $name: 'FOO', $parseBool: true },
    });

    expect(await source.readToJSON([substituteDirective()])).toEqual(false);
  });

  it('parses boolean = false', async () => {
    process.env.FOO = 'false';

    const source = new LiteralSource({
      $substitute: { $name: 'FOO', $parseBool: true },
    });

    expect(await source.readToJSON([substituteDirective()])).toEqual(false);
  });

  it('doesnt visit fallback if name is defined', async () => {
    const failDirective = forKey('$fail', () => () => {
      throw new Error();
    });

    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $substitute: { $name: 'FOO', $fallback: { $fail: true } } },
    });

    const parsed = await source.read([substituteDirective(), failDirective]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo' });
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

  it('parses ints', async () => {
    process.env.FOO = '11';

    const source = new LiteralSource({
      $substitute: { name: 'FOO', parseInt: true },
    });

    expect(await source.readToJSON([substituteDirective()])).toEqual(11);
  });

  it('fails when int is invalid', async () => {
    process.env.FOO = 'not a number';

    const source = new LiteralSource({
      $substitute: { name: 'FOO', parseInt: true },
    });

    await expect(source.read([substituteDirective()])).rejects.toThrow();
  });

  it('parses float', async () => {
    process.env.FOO = '11.2';

    const source = new LiteralSource({
      $substitute: { name: 'FOO', parseFloat: true },
    });

    expect(await source.readToJSON([substituteDirective()])).toEqual(11.2);
  });

  it('fails when float is invalid', async () => {
    process.env.FOO = 'not a number';

    const source = new LiteralSource({
      $substitute: { name: 'FOO', parseFloat: true },
    });

    await expect(source.read([substituteDirective()])).rejects.toThrow();
  });

  it('parses boolean = true', async () => {
    process.env.FOO = 'true';

    const source = new LiteralSource({
      $substitute: { name: 'FOO', parseBool: true },
    });

    expect(await source.readToJSON([substituteDirective()])).toEqual(true);
  });

  it('parses boolean = 1', async () => {
    process.env.FOO = '1';

    const source = new LiteralSource({
      $substitute: { name: 'FOO', parseBool: true },
    });

    expect(await source.readToJSON([substituteDirective()])).toEqual(true);
  });

  it('parses boolean = 0', async () => {
    process.env.FOO = '0';

    const source = new LiteralSource({
      $substitute: { name: 'FOO', parseBool: true },
    });

    expect(await source.readToJSON([substituteDirective()])).toEqual(false);
  });

  it('parses boolean = false', async () => {
    process.env.FOO = 'false';

    const source = new LiteralSource({
      $substitute: { name: 'FOO', parseBool: true },
    });

    expect(await source.readToJSON([substituteDirective()])).toEqual(false);
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

  it('reads object with $name', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO' } },
    });

    const parsed = await source.read([envVarDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo' });
  });

  it('fails with $name when not defined', async () => {
    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO' } },
    });

    await expect(source.read([envVarDirective()])).rejects.toThrow();
  });

  it('uses $name when $fallback is defined', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO', fallback: 'bar' } },
    });

    const parsed = await source.read([envVarDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo' });
  });

  it('uses $fallback when $name was not found', async () => {
    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO', fallback: 'bar' } },
    });

    const parsed = await source.read([envVarDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: 'bar' });
  });

  it('allows null value when $allowNull', async () => {
    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO', fallback: null, allowNull: true } },
    });

    const parsed = await source.read([envVarDirective()]);

    expect(parsed.toJSON()).toEqual({ foo: null });
  });

  it('does not allow number even when $allowNull', async () => {
    const source = new LiteralSource({
      foo: { $envVar: { name: 'FOO', fallback: 42, allowNull: true } },
    });

    await expect(source.read([envVarDirective()])).rejects.toThrow();
  });

  it('parses ints', async () => {
    process.env.FOO = '11';

    const source = new LiteralSource({
      $envVar: { name: 'FOO', parseInt: true },
    });

    expect(await source.readToJSON([envVarDirective()])).toEqual(11);
  });

  it('fails when int is invalid', async () => {
    process.env.FOO = 'not a number';

    const source = new LiteralSource({
      $envVar: { name: 'FOO', parseInt: true },
    });

    await expect(source.read([envVarDirective()])).rejects.toThrow();
  });

  it('parses float', async () => {
    process.env.FOO = '11.2';

    const source = new LiteralSource({
      $envVar: { name: 'FOO', parseFloat: true },
    });

    expect(await source.readToJSON([envVarDirective()])).toEqual(11.2);
  });

  it('fails when float is invalid', async () => {
    process.env.FOO = 'not a number';

    const source = new LiteralSource({
      $envVar: { name: 'FOO', parseFloat: true },
    });

    await expect(source.read([envVarDirective()])).rejects.toThrow();
  });

  it('parses boolean = true', async () => {
    process.env.FOO = 'true';

    const source = new LiteralSource({
      $envVar: { name: 'FOO', parseBool: true },
    });

    expect(await source.readToJSON([envVarDirective()])).toEqual(true);
  });

  it('parses boolean = 1', async () => {
    process.env.FOO = '1';

    const source = new LiteralSource({
      $envVar: { name: 'FOO', parseBool: true },
    });

    expect(await source.readToJSON([envVarDirective()])).toEqual(true);
  });

  it('parses boolean = 0', async () => {
    process.env.FOO = '0';

    const source = new LiteralSource({
      $envVar: { name: 'FOO', parseBool: true },
    });

    expect(await source.readToJSON([envVarDirective()])).toEqual(false);
  });

  it('parses boolean = false', async () => {
    process.env.FOO = 'false';

    const source = new LiteralSource({
      $envVar: { name: 'FOO', parseBool: true },
    });

    expect(await source.readToJSON([envVarDirective()])).toEqual(false);
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

  it('parses boolean from fallback', async () => {
    const source = new LiteralSource({
      $envVar: { name: 'FOO', parseBool: true, fallback: 'true' },
    });

    expect(await source.readToJSON([envVarDirective()])).toEqual(true);
  });
});

describe('$timestamp directive', () => {
  it('uses the current date', async () => {
    const now = new Date();

    const source = new LiteralSource({
      now: { $timestamp: true },
    });

    const parsed = await source.read([timestampDirective(() => now)]);

    expect(parsed.toJSON()).toEqual({ now: now.toISOString() });
  });

  it('uses locale date string', async () => {
    const now = new Date(2020, 11, 25, 8, 30, 0);

    const source = new LiteralSource({
      now: {
        $timestamp: {
          locale: 'en-US',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        },
      },
    });

    const parsed = await source.read([timestampDirective(() => now)]);

    expect(parsed.toJSON()).toEqual({ now: 'Friday, December 25, 2020' });
  });

  it('rejects a bad option', async () => {
    const now = new Date();

    const source = new LiteralSource({
      now: { $timestamp: null },
    });

    await expect(source.read([timestampDirective(() => now)])).rejects.toThrow();
  });

  it('rejects a bad locale', async () => {
    const now = new Date();

    const source = new LiteralSource({
      now: { $timestamp: { locale: null } },
    });

    await expect(source.read([timestampDirective(() => now)])).rejects.toThrow();
  });
});

describe('extension combinations', () => {
  it('combines $env and $extends directives', async () => {
    await withTempFiles(
      {
        'test-file.json': `{ "foo": true }`,
      },
      async (inDir) => {
        const source = new LiteralSource({
          $extends: {
            $env: {
              default: inDir('test-file.json'),
            },
          },
        });

        const parsed = await source.read([envDirective(), extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true });
      },
    );
  });

  it('combines $extends and $env directives', async () => {
    await withTempFiles(
      {
        'test-file.json': `{ "foo": true }`,
      },
      async (inDir) => {
        process.env.NODE_ENV = 'development';

        const source = new LiteralSource({
          $env: {
            default: {
              $extends: inDir('test-file.json'),
            },
            test: {
              foo: false,
            },
          },
        });

        const parsed = await source.read([envDirective(), extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ foo: true });
      },
    );
  });

  it('combines $env and $substitute directives', async () => {
    const source = new LiteralSource({
      apiUrl: {
        $env: {
          default: {
            $substitute: 'http://${MY_IP:-localhost}:3000',
          },
          qa: 'http://example.com',
        },
      },
    });

    const parsed = await source.read([envDirective(), substituteDirective()]);

    expect(parsed.toJSON()).toEqual({ apiUrl: 'http://localhost:3000' });
  });

  it('combines $extends and $substitute directives', async () => {
    await withTempFiles({ 'other-file.json': JSON.stringify({ foo: 'bar' }) }, async (inDir) => {
      process.env.SOME_VAR = inDir('./other-file.json');

      const source = new LiteralSource({
        $extends: {
          $substitute: '$SOME_VAR',
        },
      });

      const parsed = await source.read([extendsDirective(), substituteDirective()]);

      expect(parsed.toJSON()).toEqual({ foo: 'bar' });
    });
  });

  it('combines $try and $extends', async () => {
    const source = new LiteralSource({
      $try: {
        $value: {
          $extends: './test-file.json',
        },
        $fallback: {
          fellBack: true,
        },
      },
    });

    await expect(source.readToJSON([extendsDirective(), tryDirective()])).resolves.toEqual({
      fellBack: true,
    });
  });

  it('combines $if and $eq', async () => {
    const source = new LiteralSource({
      $if: {
        $check: {
          $eq: ['foo', 'foo'],
        },
        $then: 'foo',
        $else: 'bar',
      },
    });

    await expect(source.readToJSON([ifDirective(), eqDirective()])).resolves.toEqual('foo');
  });
});
