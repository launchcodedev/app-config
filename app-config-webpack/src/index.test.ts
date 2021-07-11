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
        if (err) return reject(err);
        if (!stats) return reject(new Error('no stats'));
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson({ source: true });
        const [{ modules = [] }] = children || [];

        expect(
          modules.some(({ source }) =>
            source?.includes('const configValue = {"externalApiUrl":"https://example.com"};'),
          ),
        ).toBe(true);

        done();
      });
    });
  });

  it('reads environment variable for app-config', async () => {
    process.env.APP_CONFIG = JSON.stringify({ externalApiUrl: 'https://localhost:3999' });

    await new Promise<void>((done, reject) => {
      webpack([createOptions({})], (err, stats) => {
        if (err) return reject(err);
        if (!stats) return reject(new Error('no stats'));
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson({ source: true });
        const [{ modules = [] }] = children || [];

        expect(
          modules.some(({ source }) =>
            source?.includes('const configValue = {"externalApiUrl":"https://localhost:3999"};'),
          ),
        ).toBe(true);

        done();
      });
    });
  });

  it('doesnt use window._appConfig if using noGlobal', async () => {
    process.env.APP_CONFIG = JSON.stringify({ externalApiUrl: 'https://localhost:3999' });

    await new Promise<void>((done, reject) => {
      webpack([createOptions({ noGlobal: true })], (err, stats) => {
        if (err) return reject(err);
        if (!stats) return reject(new Error('no stats'));
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson({ source: true });
        const [{ modules = [] }] = children || [];

        expect(
          modules.some(({ source }) =>
            source?.includes('const config = {"externalApiUrl":"https://localhost:3999"};'),
          ),
        ).toBe(true);

        expect(modules.some(({ source }) => source?.includes('_appConfig'))).toBe(false);

        done();
      });
    });
  });

  it('uses custom app config regex', async () => {
    process.env.APP_CONFIG = JSON.stringify({ externalApiUrl: 'https://localhost:3999' });

    await new Promise<void>((done, reject) => {
      webpack([createOptions({ intercept: /@app-config\/main/ })], (err, stats) => {
        if (err) return reject(err);
        if (!stats) return reject(new Error('no stats'));
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson({ source: true });
        const [{ modules = [] }] = children || [];

        expect(
          modules.some(({ source }) =>
            source?.includes('const configValue = {"externalApiUrl":"https://localhost:3999"};'),
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
          if (!stats) return reject(new Error('no stats'));
          if (stats.hasErrors()) reject(stats.toString());

          done();
        });
      }),
    ).rejects.toMatch('config/externalApiUrl must match format "uri"');
  });

  it('uses custom loading options to read a specific environment variable', async () => {
    process.env.MY_CONFIG = JSON.stringify({ externalApiUrl: 'https://localhost:9782' });

    await new Promise<void>((done, reject) => {
      webpack(
        [createOptions({ loading: { environmentVariableName: 'MY_CONFIG' } })],
        (err, stats) => {
          if (err) return reject(err);
          if (!stats) return reject(new Error('no stats'));
          if (stats.hasErrors()) reject(stats.toString());

          const { children } = stats.toJson({ source: true });
          const [{ modules = [] }] = children || [];

          expect(
            modules.some(({ source }) =>
              source?.includes('const configValue = {"externalApiUrl":"https://localhost:9782"};'),
            ),
          ).toBe(true);

          done();
        },
      );
    });
  });

  it('fills in currentEnvironment function', async () => {
    process.env.APP_CONFIG = JSON.stringify({ externalApiUrl: 'https://localhost:3999' });

    await new Promise<void>((done, reject) => {
      webpack([createOptions({}, true)], (err, stats) => {
        if (err) return reject(err);
        if (!stats) return reject(new Error('no stats'));
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson({ source: true });
        const [{ modules = [] }] = children || [];

        expect(
          modules.some(({ source }) => source?.includes('export function currentEnvironment()')),
        ).toBe(true);
        expect(modules.some(({ source }) => source?.includes('return "test";'))).toBe(true);

        done();
      });
    });
  });

  it('fills in currentEnvironment function with custom environment', async () => {
    process.env.APP_CONFIG = JSON.stringify({ externalApiUrl: 'https://localhost:3999' });
    process.env.APP_CONFIG_ENV = 'foobar';

    await new Promise<void>((done, reject) => {
      webpack([createOptions({}, true)], (err, stats) => {
        if (err) return reject(err);
        if (!stats) return reject(new Error('no stats'));
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson({ source: true });
        const [{ modules = [] }] = children || [];

        expect(
          modules.some(({ source }) => source?.includes('export function currentEnvironment()')),
        ).toBe(true);
        expect(modules.some(({ source }) => source?.includes('return "foobar";'))).toBe(true);

        done();
      });
    });
  });

  it('uses custom options for currentEnvironment', async () => {
    process.env.APP_CONFIG = JSON.stringify({ externalApiUrl: 'https://localhost:3999' });
    process.env.APP_CONFIG_ENV = 'test';

    await new Promise<void>((done, reject) => {
      webpack(
        [createOptions({ loading: { environmentOverride: 'foobar' } }, true)],
        (err, stats) => {
          if (err) return reject(err);
          if (!stats) return reject(new Error('no stats'));
          if (stats.hasErrors()) reject(stats.toString());

          const { children } = stats.toJson({ source: true });
          const [{ modules = [] }] = children || [];

          expect(
            modules.some(({ source }) => source?.includes('export function currentEnvironment()')),
          ).toBe(true);
          expect(modules.some(({ source }) => source?.includes('return "foobar";'))).toBe(true);

          done();
        },
      );
    });
  });

  it('fills in undefined for currentEnvironment', async () => {
    process.env.APP_CONFIG = JSON.stringify({ externalApiUrl: 'https://localhost:3999' });
    process.env.APP_CONFIG_ENV = '';

    await new Promise<void>((done, reject) => {
      webpack([createOptions({}, true)], (err, stats) => {
        if (err) return reject(err);
        if (!stats) return reject(new Error('no stats'));
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson({ source: true });
        const [{ modules = [] }] = children || [];

        expect(
          modules.some(({ source }) => source?.includes('export function currentEnvironment()')),
        ).toBe(true);
        expect(modules.some(({ source }) => source?.includes('return undefined;'))).toBe(true);

        done();
      });
    });
  });

  it.skip('does not bundle the validateConfig function', async () => {
    process.env.APP_CONFIG = JSON.stringify({ externalApiUrl: 'https://localhost:3999' });

    await new Promise<void>((done, reject) => {
      webpack([createOptions({}, true)], (err, stats) => {
        if (err) return reject(err);
        if (!stats) return reject(new Error('no stats'));
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson({ source: true });
        const [{ modules = [] }] = children || [];

        expect(modules.some(({ source }) => source?.includes('validateConfig'))).toBe(false);

        done();
      });
    });
  });
});

describe('regex', () => {
  it('matches the correct packages', () => {
    expect(regex.exec('@app-config/main')).toBeTruthy();
    expect(regex.exec('@lcdev/app-config')).toBeTruthy();
    expect(regex.exec('.app-config.yml')).toBeTruthy();
    expect(regex.exec('.app-config.prod.yml')).toBeTruthy();
    expect(regex.exec('app-config.yml')).toBeTruthy();
    expect(regex.exec('foo')).toBe(null);
  });
});
