import { LiteralSource } from '@app-config/core';
import { forKey, composeExtensions } from './index';

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
