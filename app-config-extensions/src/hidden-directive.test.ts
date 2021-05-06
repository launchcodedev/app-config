import { LiteralSource } from '@app-config/core';
import { hiddenDirective } from './hidden-directive';
import { extendsSelfDirective, envVarDirective } from './index';

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
