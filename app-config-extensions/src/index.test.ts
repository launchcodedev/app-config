import { withTempFiles } from '@app-config/test-utils';
import { LiteralSource } from '@app-config/core';
import {
  tryDirective,
  ifDirective,
  eqDirective,
  envDirective,
  extendsDirective,
  substituteDirective,
  envVarDirective,
  parseDirective,
} from './index';

/* eslint-disable no-template-curly-in-string */
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

  it('combines $envVar and $parseBool directives', async () => {
    process.env.FOO = '1';

    const source = new LiteralSource({
      featureEnabled: {
        $parseBool: {
          $envVar: 'FOO',
        },
      },
    });

    const parsed = await source.read([envVarDirective(), parseDirective()]);

    expect(parsed.toJSON()).toEqual({ featureEnabled: true });
  });

  it('combines $envVar and $parseBool directives 2', async () => {
    const source = new LiteralSource({
      featureEnabled: {
        $parseBool: {
          $envVar: { name: 'FOO', allowNull: true, fallback: null },
        },
      },
    });

    const parsed = await source.read([parseDirective(), envVarDirective()]);

    expect(parsed.toJSON()).toEqual({ featureEnabled: false });
  });
});
