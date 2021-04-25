import { LiteralSource } from '@app-config/core';
import { ifDirective } from './if-directive';
import { envDirective } from './index';

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
