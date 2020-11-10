import { FileSource, LiteralSource } from './config-source';
import {
  envDirective,
  environmentVariableSubstitution,
  extendsDirective,
  overrideDirective,
} from './extensions';
import { NotFoundError } from './errors';
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

describe('$env directive', () => {
  it('fails when not in an environment', async () => {
    const source = new LiteralSource({ $env: {} });
    await expect(source.read([envDirective()])).rejects.toThrow();
  });

  it('resolves to default environment', async () => {
    const source = new LiteralSource({ $env: { default: 42 } });
    const parsed = await source.read([envDirective()]);

    expect(parsed.toJSON()).toEqual(42);
  });

  it('resolves to test environment', async () => {
    const source = new LiteralSource({ $env: { test: 84, default: 42 } });
    const parsed = await source.read([envDirective()]);

    expect(parsed.toJSON()).toEqual(84);
  });
});

/* eslint-disable no-template-curly-in-string */
describe('$substitute directive', () => {
  it('fails with non-string values', async () => {
    const source = new LiteralSource({ $substitute: {} });
    await expect(source.read([environmentVariableSubstitution()])).rejects.toThrow();
  });

  it('simple environment variable substitution', async () => {
    process.env.FOO = 'bar';

    const source = new LiteralSource({
      foo: { $substitute: '$FOO' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: 'bar' });
  });

  it('$subs shorthand', async () => {
    process.env.FOO = 'bar';

    const source = new LiteralSource({
      foo: { $subs: '$FOO' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: 'bar' });
  });

  it('environment variable substitution fallback', async () => {
    const source = new LiteralSource({
      foo: { $substitute: '${FOO:-baz}' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: 'baz' });
  });

  it('nested substitution', async () => {
    process.env.BAR = 'qux';

    const source = new LiteralSource({
      foo: { $substitute: '${FOO:-${BAR}}' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: 'qux' });
  });

  it('special case for APP_CONFIG_ENV', async () => {
    process.env.NODE_ENV = 'qa';

    const source = new LiteralSource({
      foo: { $subs: '${APP_CONFIG_ENV}' },
    });

    const parsed = await source.read([environmentVariableSubstitution()]);

    expect(parsed.toJSON()).toEqual({ foo: 'qa' });
  });
});
