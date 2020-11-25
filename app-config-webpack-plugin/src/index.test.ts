import { resolve, join } from 'path';
import webpack from 'webpack';
import HtmlPlugin from 'html-webpack-plugin';
import AppConfigPlugin, { regex, loader, Options } from './index';

const examplesDir = resolve(__dirname, '../../examples');
const frontendProjectExampleDir = join(examplesDir, 'frontend-webpack-project');

jest.setTimeout(30000);

describe('frontend-webpack-project example', () => {
  process.chdir(frontendProjectExampleDir);

  const createOptions = (options: Options) => ({
    mode: 'development' as const,
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

        expect(modules.map(({ source }) => source)).toContain(
          'export default {"externalApiUrl":"https://example.com"};',
        );

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

        expect(modules.map(({ source }) => source)).toContain('export default window._appConfig;');

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

        expect(modules.map(({ source }) => source)).toContain(
          'export default {"externalApiUrl":"https://localhost:3999"};',
        );

        done();
      });
    });
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

          expect(modules.map(({ source }) => source)).toContain(
            'export default {"externalApiUrl":"https://localhost:9782"};',
          );

          done();
        },
      );
    });
  });
});
