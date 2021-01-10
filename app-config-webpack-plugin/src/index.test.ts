import { resolve, join } from 'path';
import webpack from 'webpack';
import HtmlPlugin from 'html-webpack-plugin';
import AppConfigPlugin, { regex, loader, Options } from './index';

const examplesDir = resolve(__dirname, '../../examples');
const frontendProjectExampleDir = join(examplesDir, 'frontend-webpack-project');

jest.setTimeout(30000);

describe('frontend-webpack-project example', () => {
  process.chdir(frontendProjectExampleDir);

  const createOptions = (options: Options, production = false) => ({
    mode: production ? ('production' as const) : ('development' as const),
    entry: join(frontendProjectExampleDir, 'src/index.ts'),
    output: {
      filename: 'main.js',
      path: resolve(frontendProjectExampleDir, 'dist'),
    },

    plugins: [new HtmlPlugin(), new AppConfigPlugin(options)],

    module: {
      rules: [{ test: regex, use: { loader, options } }],
    },
  });

  it('builds the project without header injection', async () => {
    await new Promise<void>((done, reject) => {
      webpack([createOptions({})], (err, stats) => {
        if (err) reject(err);
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson();
        const [{ modules = [] }] = children || [];

        expect(
          modules.some(({ source }) =>
            source?.includes('const config = {"externalApiUrl":"https://example.com"};'),
          ),
        ).toBe(true);

        done();
      });
    });
  });

  it('builds the project with header injection', async () => {
    await new Promise<void>((done, reject) => {
      webpack([createOptions({ headerInjection: true })], (err, stats) => {
        if (err) reject(err);
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson();
        const [{ modules = [] }] = children || [];

        expect(
          modules.some(({ source }) => source?.includes('const config = window._appConfig;')),
        ).toBe(true);

        done();
      });
    });
  });

  it('reads environment variable for app-config', async () => {
    process.env.APP_CONFIG = JSON.stringify({ externalApiUrl: 'https://localhost:3999' });

    await new Promise<void>((done, reject) => {
      webpack([createOptions({})], (err, stats) => {
        if (err) reject(err);
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson();
        const [{ modules = [] }] = children || [];

        expect(
          modules.some(({ source }) =>
            source?.includes('const config = {"externalApiUrl":"https://localhost:3999"};'),
          ),
        ).toBe(true);

        done();
      });
    });
  });

  it('throws validation errors', async () => {
    process.env.APP_CONFIG = JSON.stringify({ externalApiUrl: 'not a uri' });

    await expect(
      new Promise<void>((done, reject) => {
        webpack([createOptions({})], (err, stats) => {
          if (err) return reject(err);
          if (stats.hasErrors()) return reject(stats.toString());

          done();
        });
      }),
    ).rejects.toMatch('config/externalApiUrl should match format "uri"');
  });

  it('uses custom loading options to read a specific environment variable', async () => {
    process.env.MY_CONFIG = JSON.stringify({ externalApiUrl: 'https://localhost:9782' });

    await new Promise<void>((done, reject) => {
      webpack(
        [createOptions({ loading: { environmentVariableName: 'MY_CONFIG' } })],
        (err, stats) => {
          if (err) reject(err);
          if (stats.hasErrors()) reject(stats.toString());

          const { children } = stats.toJson();
          const [{ modules = [] }] = children || [];

          expect(
            modules.some(({ source }) =>
              source?.includes('const config = {"externalApiUrl":"https://localhost:9782"};'),
            ),
          ).toBe(true);

          done();
        },
      );
    });
  });

  it('does not bundle the validateConfig function', async () => {
    process.env.APP_CONFIG = JSON.stringify({ externalApiUrl: 'https://localhost:3999' });

    await new Promise<void>((done, reject) => {
      webpack([createOptions({}, true)], (err, stats) => {
        if (err) reject(err);
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson();
        const [{ modules = [] }] = children || [];

        expect(modules.some(({ source }) => source?.includes('validateConfig'))).toBe(false);

        done();
      });
    });
  });
});
