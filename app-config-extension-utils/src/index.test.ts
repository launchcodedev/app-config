import { LiteralSource } from '@app-config/core';
import {
  forKey,
  composeExtensions,
  validateOptions,
  ParsingExtensionInvalidOptions,
} from './index';

const foo = forKey('$foo', () => (parse) => parse('foo!'));
const bar = forKey('$bar', () => (parse) => parse('bar!'));
const plusOne = forKey(['+1', '$plusOne'], (value) => (parse) =>
  parse((value as number) + 1, { shouldFlatten: true }),
);

describe('forKey', () => {
  it('only applies for keys given', async () => {
    const source = {
      a: {
        b: {
          $plusOne: 33,
        },
        c: {
          '+1': 1,
        },
        d: {
          $foo: 'bar',
        },
      },
    };

    expect(await new LiteralSource(source).readToJSON([foo, bar, plusOne])).toEqual({
      a: {
        b: 34,
        c: 2,
        d: {
          $foo: 'foo!',
        },
      },
    });
  });
});

describe('composeExtensions', () => {
  it('combines two extensions', async () => {
    const source = {
      $foo: 1,
      $bar: 2,
    };

    expect(await new LiteralSource(source).readToJSON([foo, bar])).toEqual({
      $foo: 'foo!',
      $bar: 'bar!',
    });

    const combined = composeExtensions([foo, bar]);

    expect(await new LiteralSource(source).readToJSON([combined])).toEqual({
      $foo: 'foo!',
      $bar: 'bar!',
    });
  });

  it('combines two extensions, and applies them in nested properties', async () => {
    const source = {
      $foo: 1,
      a: {
        b: {
          $bar: 2,
        },
      },
    };

    expect(await new LiteralSource(source).readToJSON([foo, bar])).toEqual({
      $foo: 'foo!',
      a: {
        b: {
          $bar: 'bar!',
        },
      },
    });

    const combined = composeExtensions([foo, bar]);

    expect(await new LiteralSource(source).readToJSON([combined])).toEqual({
      $foo: 'foo!',
      a: {
        b: {
          $bar: 'bar!',
        },
      },
    });
  });
});

describe('validateOptions', () => {
  const ext1 = validateOptions(
    (SchemaBuilder) => SchemaBuilder.stringSchema(),
    (value) => (parse) => parse(value + '!', { shouldFlatten: true }),
  );

  const ext2 = validateOptions(
    (SchemaBuilder) => SchemaBuilder.integerSchema(),
    (value) => (parse) => parse(value + 42, { shouldFlatten: true }),
  );

  const ext3 = forKey(
    '$ext3',
    validateOptions(
      (SchemaBuilder) => SchemaBuilder.integerSchema(),
      (value) => (parse) => parse(value + 42, { shouldFlatten: true }),
    ),
  );

  it('allows valid options', async () => {
    expect(await new LiteralSource('start').readToJSON([ext1])).toEqual('start!');
    expect(await new LiteralSource(42).readToJSON([ext2])).toEqual(84);
  });

  it('disallows invalid options', async () => {
    await expect(new LiteralSource(42).readToJSON([ext1])).rejects.toThrow(
      ParsingExtensionInvalidOptions,
    );
    await expect(new LiteralSource('start').readToJSON([ext2])).rejects.toThrow(
      ParsingExtensionInvalidOptions,
    );
  });

  it('composes forKey and validateOptions', async () => {
    expect(await new LiteralSource('start').readToJSON([ext3])).toEqual('start');
    expect(await new LiteralSource({ $ext3: 0 }).readToJSON([ext3])).toEqual(42);
    await expect(new LiteralSource({ $ext3: 'start' }).readToJSON([ext3])).rejects.toThrow(
      'Validation failed in "$ext3": Invalid parameters: data should be integer',
    );
    await expect(new LiteralSource({ a: { $ext3: 'start' } }).readToJSON([ext3])).rejects.toThrow(
      'Validation failed in "a.$ext3": Invalid parameters: data should be integer',
    );
  });
});
