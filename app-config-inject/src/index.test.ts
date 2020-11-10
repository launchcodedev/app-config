import { injectHtml } from './index';

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

describe('injectHtml', () => {
  it('fails when HTML does not contain script tag', async () => {
    await expect(
      injectHtml(
        `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Webpack App</title>
            <meta name="viewport" content="width=device-width,initial-scale=1">
          </head>
          <body><script src="/main.js"></script></body>
        </html>
      `,
        { validate: true },
      ),
    ).rejects.toThrow();
  });

  it('adds app-config to an empty script tag', async () => {
    process.env.APP_CONFIG = JSON.stringify({ foo: 42 });

    const injected = await injectHtml(
      `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Webpack App</title>
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <script id="app-config"></script>
          </head>
          <body><script src="/main.js"></script></body>
        </html>
      `,
      { validate: false },
    );

    expect(injected).toMatchSnapshot();
  });

  it('adds app-config to an existing script tag', async () => {
    process.env.APP_CONFIG = JSON.stringify({ foo: 88 });

    const injected = await injectHtml(
      `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Webpack App</title>
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <script id="app-config">window._appConfig = {}</script>
          </head>
          <body><script src="/main.js"></script></body>
        </html>
      `,
      { validate: false },
    );

    expect(injected).toMatchSnapshot();
  });

  it('uses provided loadConfig options', async () => {
    process.env.MY_CONFIG = JSON.stringify({ foo: true });

    const injected = await injectHtml(
      `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>Webpack App</title>
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <script id="app-config">window._appConfig = {}</script>
          </head>
          <body><script src="/main.js"></script></body>
        </html>
      `,
      { validate: false, configOptions: { environmentVariableName: 'MY_CONFIG' } },
    );

    expect(injected).toMatchSnapshot();
  });
});
