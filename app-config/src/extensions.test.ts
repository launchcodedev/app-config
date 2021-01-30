import { FileSource, LiteralSource, NotFoundError } from '@app-config/core';
import {
  v1Compat,
  envDirective,
  extendsDirective,
  extendsSelfDirective,
  overrideDirective,
  encryptedDirective,
  timestampDirective,
  environmentVariableSubstitution,
  gitRefDirectives,
} from './extensions';
import { generateSymmetricKey, encryptValue } from './encryption';

import { withTempFiles } from './test-util';

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
    await expect(source.read([environmentVariableSubstitution()])).rejects.toThrow();
  });

  it('does simple environment variable substitution', async () => {
    process.env.FOO = 'foo';
    process.env.BAR = 'bar';

    const source = new LiteralSource({
      foo: { $substitute: '$FOO' },
      bar: { $substitute: '$BAR' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo', bar: 'bar' });
  });

  it('uses $subs shorthand', async () => {
    process.env.FOO = 'bar';

    const source = new LiteralSource({
      foo: { $subs: '$FOO' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: 'bar' });
  });

  it('does environment variable substitution fallback', async () => {
    const source = new LiteralSource({
      foo: { $substitute: '${FOO:-baz}' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: 'baz' });
  });

  it('does environment variable substitution with empty value', async () => {
    process.env.FOO = '';

    const source = new LiteralSource({
      foo: { $substitute: '${FOO}' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: '' });
  });

  it('does environment variable substitution with empty fallback', async () => {
    const source = new LiteralSource({
      foo: { $substitute: '${FOO:-}' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: '' });
  });

  it('flows through nested substitution', async () => {
    process.env.BAR = 'qux';

    const source = new LiteralSource({
      foo: { $substitute: '${FOO:-${BAR}}' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: 'qux' });
  });

  it('does variable substitutions mid-string', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $substitute: 'bar ${FOO} bar' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: 'bar foo bar' });
  });

  it('does multiple variable substitutions', async () => {
    process.env.FOO = 'foo';
    process.env.BAR = 'bar';

    const source = new LiteralSource({
      foo: { $substitute: '${FOO} $BAR' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo bar' });
  });

  it('does multiple variable substitutions with fallbacks', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: { $substitute: '${FOO} ${BAR:-bar}' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: 'foo bar' });
  });

  it('does variable substitution in array', async () => {
    process.env.FOO = 'foo';

    const source = new LiteralSource({
      foo: [{ $substitute: '${FOO}' }, 'bar'],
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: ['foo', 'bar'] });
  });

  it('reads special case variable $APP_CONFIG_ENV', async () => {
    process.env.NODE_ENV = 'qa';

    const source = new LiteralSource({
      foo: { $subs: '${APP_CONFIG_ENV}' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: 'qa' });
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

describe('encryptedDirective', () => {
  it('loads an encrypted value', async () => {
    const symmetricKey = await generateSymmetricKey(1);

    const source = new LiteralSource({
      foo: await encryptValue('foobar', symmetricKey),
    });

    const parsed = await source.read([encryptedDirective(symmetricKey)]);

    expect(parsed.toJSON()).toEqual({ foo: 'foobar' });
  });

  it('loads an array of encrypted values', async () => {
    const symmetricKey = await generateSymmetricKey(1);

    const source = new LiteralSource({
      foo: [
        await encryptValue('value-1', symmetricKey),
        await encryptValue('value-2', symmetricKey),
        await encryptValue('value-3', symmetricKey),
      ],
    });

    const parsed = await source.read([encryptedDirective(symmetricKey)]);

    expect(parsed.toJSON()).toEqual({ foo: ['value-1', 'value-2', 'value-3'] });
  });
});

describe('$git directive', () => {
  it('retrieves the commit ref', async () => {
    const source = new LiteralSource({
      gitRef: { $git: 'commit' },
    });

    const parsed = await source.read([
      gitRefDirectives(() =>
        Promise.resolve({
          commitRef: '6e96485ebf21082949c97a477b529b7a1c97a8b9',
          branchName: 'master',
        }),
      ),
    ]);

    expect(parsed.toJSON()).toEqual({ gitRef: '6e96485ebf21082949c97a477b529b7a1c97a8b9' });
  });

  it('retrieves the short commit ref', async () => {
    const source = new LiteralSource({
      gitRef: { $git: 'commitShort' },
    });

    const parsed = await source.read([
      gitRefDirectives(() =>
        Promise.resolve({
          commitRef: '6e96485ebf21082949c97a477b529b7a1c97a8b9',
          branchName: 'master',
        }),
      ),
    ]);

    expect(parsed.toJSON()).toEqual({ gitRef: '6e96485' });
  });

  it('retrieves the branch name', async () => {
    const source = new LiteralSource({
      gitRef: { $git: 'branch' },
    });

    const parsed = await source.read([
      gitRefDirectives(() =>
        Promise.resolve({
          commitRef: '6e96485ebf21082949c97a477b529b7a1c97a8b9',
          branchName: 'master',
        }),
      ),
    ]);

    expect(parsed.toJSON()).toEqual({ gitRef: 'master' });
  });

  it('fails when no branch is checked out', async () => {
    const source = new LiteralSource({
      gitRef: { $git: 'branch' },
    });

    await expect(
      source.read([
        gitRefDirectives(() =>
          Promise.resolve({
            commitRef: '6e96485ebf21082949c97a477b529b7a1c97a8b9',
          }),
        ),
      ]),
    ).rejects.toThrow();
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

    const parsed = await source.read([envDirective(), environmentVariableSubstitution()]);

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

      const parsed = await source.read([extendsDirective(), environmentVariableSubstitution()]);

      expect(parsed.toJSON()).toEqual({ foo: 'bar' });
    });
  });

  it('combines v1 compat and $extends directives', async () => {
    await withTempFiles(
      {
        'some-file.json': JSON.stringify({ a: 'foo' }),
        'other-file.json': JSON.stringify({ b: 'bar' }),
      },
      async (inDir) => {
        const source = new LiteralSource({
          'app-config': {
            extends: inDir('./some-file.json'),
          },
          $extends: inDir('./other-file.json'),
        });

        const parsed = await source.read([v1Compat(), extendsDirective()]);

        expect(parsed.toJSON()).toEqual({ a: 'foo', b: 'bar' });
      },
    );
  });
});
