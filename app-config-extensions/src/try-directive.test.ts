import { LiteralSource, Fallbackable } from '@app-config/core';
import { forKey } from '@app-config/extension-utils';
import { tryDirective } from './try-directive';

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
