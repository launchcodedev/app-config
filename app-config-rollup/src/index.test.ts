import { rollup } from 'rollup';
import { withTempFiles } from '@app-config/test-utils';
import commonJsRollup from '@rollup/plugin-commonjs';
import appConfigRollup from './index';

describe('Rollup Plugin', () => {
  let logSpy: jest.SpyInstance;
  beforeEach(() => {
    jest.clearAllMocks();

    logSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  it('processes app-config', () =>
    withTempFiles(
      {
        '.app-config.yml': `
          foo: https://example.com
          bar: baz
        `,
        '.app-config.schema.yml': `
          type: object
          properties:
            foo:
              type: string
              format: uri
        `,
        'entry.js': `
          import config, { validateConfig } from '@app-config/main';

          validateConfig(config);
          console.log(config);
        `,
      },
      async (inDir) => {
        const bundle = await rollup({
          input: inDir('entry.js'),
          plugins: [
            appConfigRollup({ loadingOptions: { directory: inDir('.') } }),
            // commonjs plugin is required when we use ajv-formats, but not otherwise
            commonJsRollup(),
          ],
        });

        const { output } = await bundle.generate({});
        expect(output).toHaveLength(1);
        expect(output[0].code).toMatchSnapshot();

        // avoid polluting the global namespace
        const globalThis = {}; // eslint-disable-line
        // we specially want to `eval` the generated code to make sure it wasn't messed up
        eval(output[0].code); // eslint-disable-line no-eval

        expect(logSpy).toHaveBeenLastCalledWith({ foo: 'https://example.com', bar: 'baz' });
      },
    ));

  it('processes empty app-config', () =>
    withTempFiles(
      {
        '.app-config.yml': ``,
        '.app-config.schema.yml': ``,
        'entry.js': `
          import config from '@app-config/main';

          console.log(config);
        `,
      },
      async (inDir) => {
        const bundle = await rollup({
          input: inDir('entry.js'),
          plugins: [appConfigRollup({ loadingOptions: { directory: inDir('.') } })],
        });

        const { output } = await bundle.generate({});
        expect(output).toHaveLength(1);
        expect(output[0].code).toMatchSnapshot();

        // avoid polluting the global namespace
        const globalThis = {}; // eslint-disable-line
        // we specially want to `eval` the generated code to make sure it wasn't messed up
        eval(output[0].code); // eslint-disable-line no-eval

        expect(logSpy).toHaveBeenLastCalledWith({});
      },
    ));

  it('fails without app-config', () =>
    withTempFiles(
      {
        'entry.js': `
          import config from '@app-config/main';
          console.log(config);
        `,
      },
      async (inDir) => {
        await expect(
          rollup({
            input: inDir('entry.js'),
            plugins: [appConfigRollup({ loadingOptions: { directory: inDir('.') } })],
          }),
        ).rejects.toThrowError('Could not load @app-config/main');
      },
    ));
});
