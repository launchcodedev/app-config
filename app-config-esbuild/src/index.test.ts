import { withTempFiles } from '@app-config/test-utils';
import { build } from 'esbuild';
import createPlugin from './index';

it('loads config correctly', () =>
  withTempFiles(
    {
      '.app-config.schema.yml': `
        type: object
        additionalProperties: true
      `,
      '.app-config.yml': `
        foo: bar
      `,
      'a.js': `
        import config from '@app-config/main';
        console.log(config);
      `,
    },
    async (inDir) => {
      const res = await build({
        entryPoints: [inDir('a.js')],
        plugins: [createPlugin({ loadingOptions: { directory: inDir('.') } })],
        bundle: true,
        minify: true,
        write: false,
      });

      expect(res.outputFiles[0].text).toMatchSnapshot();
    },
  ));

it('fails when config is incorrect', () =>
  withTempFiles(
    {
      '.app-config.schema.yml': `
        type: object
        additionalProperties: false
      `,
      '.app-config.yml': `
        foo: bar
      `,
      'a.js': `
        import config from '@app-config/main';
        console.log(config);
      `,
    },
    async (inDir) => {
      await expect(
        build({
          entryPoints: [inDir('a.js')],
          plugins: [createPlugin({ loadingOptions: { directory: inDir('.') } })],
          bundle: true,
          minify: true,
          write: false,
        }),
      ).rejects.toThrow(
        'error: [plugin: @app-config/esbuild] Config is invalid: config should NOT have additional properties',
      );
    },
  ));

it('loads validation function', () =>
  withTempFiles(
    {
      '.app-config.schema.yml': `
        type: object
        additionalProperties: false
        properties:
          foo: { type: string }
      `,
      '.app-config.yml': `
        foo: bar
      `,
      'a.js': `
        import { validateConfig } from '@app-config/main';

        validateConfig({ foo: 12 })
      `,
    },
    async (inDir) => {
      const res = await build({
        entryPoints: [inDir('a.js')],
        plugins: [createPlugin({ loadingOptions: { directory: inDir('.') } })],
        bundle: true,
        minify: true,
        write: false,
      });

      expect(res.outputFiles[0].text).toMatchSnapshot();
    },
  ));

it('loads currentEnvironment', () =>
  withTempFiles(
    {
      '.app-config.schema.yml': `
        type: object
        additionalProperties: false
        properties:
          foo: { type: string }
      `,
      '.app-config.yml': `
        foo: bar
      `,
      'a.js': `
        import { currentEnvironment } from '@app-config/main';

        console.log(currentEnvironment())
      `,
    },
    async (inDir) => {
      const res = await build({
        entryPoints: [inDir('a.js')],
        plugins: [createPlugin({ loadingOptions: { directory: inDir('.') } })],
        bundle: true,
        minify: true,
        write: false,
      });

      expect(res.outputFiles[0].text).toMatchSnapshot();
    },
  ));

it('loads with doNotLoadConfig', () =>
  withTempFiles(
    {
      '.app-config.schema.yml': `
        type: object
        additionalProperties: false
        properties:
          foo: { type: string }
      `,
      'a.js': `
        import { config, validateConfig } from '@app-config/main';

        validateConfig(config);
      `,
    },
    async (inDir) => {
      const res = await build({
        entryPoints: [inDir('a.js')],
        plugins: [
          createPlugin({ schemaLoadingOptions: { directory: inDir('.') }, doNotLoadConfig: true }),
        ],
        bundle: true,
        minify: true,
        write: false,
      });

      expect(res.outputFiles[0].text).toMatchSnapshot();
    },
  ));

it('loads with doNotLoadConfig and no validation function', () =>
  withTempFiles(
    {
      '.app-config.schema.yml': `
        type: object
        additionalProperties: false
        properties:
          foo: { type: string }
      `,
      'a.js': `
        import { config } from '@app-config/main';

        console.log(config);
      `,
    },
    async (inDir) => {
      const res = await build({
        entryPoints: [inDir('a.js')],
        plugins: [
          createPlugin({
            schemaLoadingOptions: { directory: inDir('.') },
            doNotLoadConfig: true,
            injectValidationFunction: false,
          }),
        ],
        bundle: true,
        minify: true,
        write: false,
      });

      expect(res.outputFiles[0].text).toMatchSnapshot();
    },
  ));
