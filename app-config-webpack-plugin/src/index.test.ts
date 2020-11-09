import { resolve, join } from 'path';
import webpack from 'webpack';
import HtmlPlugin from 'html-webpack-plugin';
import AppConfigPlugin, { regex, loader } from './index';

const examplesDir = resolve(__dirname, '../../examples');
const frontendProjectExampleDir = join(examplesDir, 'frontend-webpack-project');

jest.setTimeout(30000);

describe('frontend-webpack-project example', () => {
  process.chdir(frontendProjectExampleDir);

  const optionsWithoutHeaderInjection = {
    mode: 'development' as const,
    entry: join(frontendProjectExampleDir, 'src/index.ts'),
    output: {
      filename: 'main.js',
      path: resolve(frontendProjectExampleDir, 'dist'),
    },

    plugins: [new HtmlPlugin(), new AppConfigPlugin()],

    module: {
      rules: [{ test: regex, use: { loader } }],
    },
  };

  const optionsWithHeaderInjection = {
    mode: 'development' as const,
    entry: join(frontendProjectExampleDir, 'src/index.ts'),
    output: {
      filename: 'main.js',
      path: resolve(frontendProjectExampleDir, 'dist'),
    },

    plugins: [new HtmlPlugin(), new AppConfigPlugin({ headerInjection: true })],

    module: {
      rules: [{ test: regex, use: { loader, options: { headerInjection: true } } }],
    },
  };

  it('builds the project without header injection', async () => {
    await new Promise((resolve, reject) => {
      webpack([optionsWithoutHeaderInjection], (err, stats) => {
        if (err) reject(err);
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson();
        const [{ modules = [] }] = children || [];

        expect(modules.map(({ source }) => source)).toContain(
          'export default {"externalApiUrl":"https://example.com"};',
        );

        resolve();
      });
    });
  });

  it('builds the project with header injection', async () => {
    await new Promise((resolve, reject) => {
      webpack([optionsWithHeaderInjection], (err, stats) => {
        if (err) reject(err);
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson();
        const [{ modules = [] }] = children || [];

        expect(modules.map(({ source }) => source)).toContain('export default window._appConfig;');

        resolve();
      });
    });
  });

  it('reads environment variable for app-config', async () => {
    process.env.APP_CONFIG = JSON.stringify({ externalApiUrl: 'https://localhost:3999' });

    await new Promise((resolve, reject) => {
      webpack([optionsWithoutHeaderInjection], (err, stats) => {
        if (err) reject(err);
        if (stats.hasErrors()) reject(stats.toString());

        const { children } = stats.toJson();
        const [{ modules = [] }] = children || [];

        expect(modules.map(({ source }) => source)).toContain(
          'export default {"externalApiUrl":"https://localhost:3999"};',
        );

        resolve();
      });
    });
  });
});
