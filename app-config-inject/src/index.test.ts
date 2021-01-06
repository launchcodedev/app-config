import { stdin } from 'mock-stdin'; // eslint-disable-line import/no-extraneous-dependencies
import { injectHtml, consumeStdin } from './index';

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

  it('validates provided app-config', async () => {
    process.env.APP_CONFIG = JSON.stringify({ foo: 42 });
    process.env.APP_CONFIG_SCHEMA = JSON.stringify({ type: 'object', additionalProperties: false });

    const html = `
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
    `;

    await expect(injectHtml(html, { validate: true })).rejects.toThrow();

    process.env.APP_CONFIG = JSON.stringify({});

    await expect(injectHtml(html, { validate: true })).resolves.toMatchSnapshot();
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

describe('consumeStdin', () => {
  it('consumes all lines until end', async () => {
    await mockedStdin(async (send, end) => {
      send('foo')
        .then(() => send('bar'))
        .then(() => send('baz'))
        .then(() => end())
        .catch(() => {});

      // we expect newlines to be eaten up, since this function is used for html and base64 data
      expect(await consumeStdin()).toBe('foobarbaz');
    });
  });
});

async function mockedStdin(
  callback: (send: (text: string) => Promise<void>, end: () => void) => Promise<void>,
) {
  const mock = stdin();

  try {
    const send = (text: string) =>
      new Promise<void>((resolve) => {
        setTimeout(() => {
          mock.send(text);
          mock.send('\n');
          resolve();
        }, 0);
      });

    await callback(send, () => mock.end());
  } finally {
    mock.restore();
  }
}
