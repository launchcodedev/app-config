import { FileType } from './file-loader';
import { loadConfig, loadConfigSync, ConfigSource } from './config';
import { withFakeFiles } from './test-util';

test('load env config', async () => {
  process.env.APP_CONFIG = `
    [foo]
    bar = true
  `;

  const { config, secrets, fileType, source } = await loadConfig();

  expect(config).toEqual({
    foo: {
      bar: true,
    },
  });

  expect(secrets).toBe(undefined);
  expect(fileType).toBe(FileType.TOML);
  expect(source).toBe(ConfigSource.EnvVar);

  delete process.env.APP_CONFIG;
});

test('load env sync', async () => {
  process.env.APP_CONFIG = `
    [foo]
    bar = true
  `;

  const { config, secrets, fileType, source } = loadConfigSync();

  expect(config).toEqual({
    foo: {
      bar: true,
    },
  });

  expect(secrets).toBe(undefined);
  expect(fileType).toBe(FileType.TOML);
  expect(source).toBe(ConfigSource.EnvVar);

  delete process.env.APP_CONFIG;
});

test('load app config file', async () => {
  await withFakeFiles([
    [
      '.app-config.toml',
      `
      [to]
      bar = "foo"
      `,
    ],
  ], async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual({});
    expect(config).toEqual({
      to: { bar: 'foo' },
    });
  });
});

test('load non dotfile config file', async () => {
  await withFakeFiles([
    [
      'app-config.toml',
      `
      bar = "foo"
      `,
    ],
  ], async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual({});
    expect(config).toEqual({
      bar: 'foo',
    });
  });
});

test('load secrets file', async () => {
  await withFakeFiles([
    [
      '.app-config.toml',
      `
      [to]
      bar = "foo"
      `,
    ],
    [
      '.app-config.secrets.toml',
      `
      password = "pwd"
      `,
    ],
  ], async (dir) => {
    const { config, secrets } = await loadConfig(dir);

    expect(secrets).toEqual({ password: 'pwd' });
    expect(config).toEqual({
      to: { bar: 'foo' },
      password: 'pwd',
    });
  });
});

test('load config sync', async () => {
  await withFakeFiles([
    [
      '.app-config.toml',
      `
      [to]
      bar = "foo"
      `,
    ],
  ], async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual({});
    expect(config).toEqual({
      to: { bar: 'foo' },
    });
  });
});

test('load config extends in env', async () => {
  process.env.APP_CONFIG = `
    [app-config]
    extends = ["invalid.toml"]
  `;

  // we can't extend files in an env config
  await expect(loadConfig()).rejects.toThrow();

  delete process.env.APP_CONFIG;
});

test('load config extends one file', async () => {
  await withFakeFiles([
    [
      '.app-config.toml',
      `
      [app-config]
      extends = ".app-config.extender.yml"

      [foo]
      bar = "baz"
      `,
    ],
    [
      '.app-config.extender.yml',
      `
      baz:
        bar: 'foo'
      `,
    ],
  ], async (dir) => {
    const { config } = await loadConfig(dir);

    expect(config).toEqual({
      foo: {
        bar: 'baz',
      },
      baz: {
        bar: 'foo',
      },
    });
  });
});

test('load config extends multiple file', async () => {
  await withFakeFiles([
    [
      '.app-config.toml',
      `
      [app-config]
      extends = [
        ".app-config.extender1.yml",
        ".app-config.extender2.yml",
        ".app-config.extender3.yml",
      ]

      [foo]
      bar = "baz"
      `,
    ],
    [
      '.app-config.extender1.yml',
      `
      baz1:
        bar: 'foo1'
      `,
    ],
    [
      '.app-config.extender2.yml',
      `
      baz2:
        bar: 'foo2'
      `,
    ],
    [
      '.app-config.extender3.yml',
      `
      baz3:
        bar: 'foo3'
      `,
    ],
  ], async (dir) => {
    const { config } = await loadConfig(dir);

    expect(config).toEqual({
      foo: {
        bar: 'baz',
      },
      baz1: {
        bar: 'foo1',
      },
      baz2: {
        bar: 'foo2',
      },
      baz3: {
        bar: 'foo3',
      },
    });
  });
});

test('load config extends one file sync', async () => {
  await withFakeFiles([
    [
      '.app-config.toml',
      `
      [app-config]
      extends = ".app-config.extender.yml"

      [foo]
      bar = "baz"
      `,
    ],
    [
      '.app-config.extender.yml',
      `
      baz:
        bar: 'foo'
      `,
    ],
  ], async (dir) => {
    const { config } = loadConfigSync(dir);

    expect(config).toEqual({
      foo: {
        bar: 'baz',
      },
      baz: {
        bar: 'foo',
      },
    });
  });
});

test('load config extends multiple file sync', async () => {
  await withFakeFiles([
    [
      '.app-config.toml',
      `
      [app-config]
      extends = [
        ".app-config.extender1.yml",
        ".app-config.extender2.yml",
        ".app-config.extender3.yml",
      ]

      [foo]
      bar = "baz"
      `,
    ],
    [
      '.app-config.extender1.yml',
      `
      baz1:
        bar: 'foo1'
      `,
    ],
    [
      '.app-config.extender2.yml',
      `
      baz2:
        bar: 'foo2'
      `,
    ],
    [
      '.app-config.extender3.yml',
      `
      baz3:
        bar: 'foo3'
      `,
    ],
  ], async (dir) => {
    const { config } = loadConfigSync(dir);

    expect(config).toEqual({
      foo: {
        bar: 'baz',
      },
      baz1: {
        bar: 'foo1',
      },
      baz2: {
        bar: 'foo2',
      },
      baz3: {
        bar: 'foo3',
      },
    });
  });
});
