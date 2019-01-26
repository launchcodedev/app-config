import { join } from 'path';
import { FileType } from './file-loader';
import { loadConfig, loadConfigSync, ConfigSource } from './config';
import { withFakeFiles } from './test-util';

describe('load env config', () => {
  beforeEach(() => {
    process.env.APP_CONFIG = `
      [foo]
      bar = true
    `;
  });

  afterEach(() => {
    delete process.env.APP_CONFIG;
  });

  const expected = {
    foo: {
      bar: true,
    },
  };

  test('async', async () => {
    const { config, secrets, fileType, source } = await loadConfig();

    expect(config).toEqual(expected);
    expect(secrets).toBe(undefined);
    expect(fileType).toBe(FileType.TOML);
    expect(source).toBe(ConfigSource.EnvVar);
  });

  test('sync', async () => {
    const { config, secrets, fileType, source } = loadConfigSync();

    expect(config).toEqual(expected);
    expect(secrets).toBe(undefined);
    expect(fileType).toBe(FileType.TOML);
    expect(source).toBe(ConfigSource.EnvVar);
  });
});

describe('load unhidden config file', () => {
  const files: [string, string][] = [
    [
      'app-config.toml',
      `
      [nested]
      foo = "baz"
      `,
    ],
  ];

  const expected = {
    nested: { foo: 'baz' },
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});

describe('load toml config file', () => {
  const files: [string, string][] = [
    [
      '.app-config.toml',
      `
      [to]
      bar = "foo"
      `,
    ],
  ];

  const expected = {
    to: { bar: 'foo' },
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});

describe('load yaml config file', () => {
  const files: [string, string][] = [
    [
      'app-config.yml',
      `
      nested:
        baz: 2
      `,
    ],
  ];

  const expected = {
    nested: { baz: 2 },
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});

describe('load json config file', () => {
  const files: [string, string][] = [
    [
      'app-config.json',
      `
      {
        "prop": "5"
      }
      `,
    ],
  ];

  const expected = {
    prop: '5',
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.JSON);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.JSON);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});

describe('load json5 config file', () => {
  const files: [string, string][] = [
    [
      'app-config.json5',
      `
      {
        "meaningOfLife": 42, // with comment
      }
      `,
    ],
  ];

  const expected = {
    meaningOfLife: 42,
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.JSON);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.JSON);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});

describe('config file source', () => {
  const files: [string, string][] = [
    [ 'app-config.json5', `{}` ],
  ];

  test('async', () => withFakeFiles(files, async (dir) => {
    const { fileSource, fileType } = await loadConfig(dir);

    expect(fileSource).toBe(join(dir, 'app-config.json5'));
    expect(fileType).toBe(FileType.JSON);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { fileSource, fileType } = loadConfigSync(dir);

    expect(fileSource).toBe(join(dir, 'app-config.json5'));
    expect(fileType).toBe(FileType.JSON);
  }));
});

describe('load secrets file', () => {
  const files: [string, string][] = [
    [
      'app-config.toml',
      `
      [nest]
      normal = "insecure"
      `,
    ],
    [
      'app-config.secrets.toml',
      `
      [nest]
      password = "secure"
      `,
    ],
  ];

  const expected = {
    nest: {
      normal: 'insecure',
      password: 'secure',
    },
  };

  const expectedSecrets = {
    nest: {
      password: 'secure',
    },
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual(expectedSecrets);
    expect(config).toEqual(expected);
  }));

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual(expectedSecrets);
    expect(config).toEqual(expected);
  }));
});

describe('extends in env var', () => {
  test('async', async () => {
    process.env.APP_CONFIG = `
      [app-config]
      extends = ["invalid.toml"]
    `;

    // we can't extend files in an env config
    await expect(loadConfig()).rejects.toThrow();

    delete process.env.APP_CONFIG;
  });

  test('sync', () => {
    process.env.APP_CONFIG = `
      [app-config]
      extends = ["invalid.toml"]
    `;

    // we can't extend files in an env config
    expect(() => loadConfigSync()).toThrow();

    delete process.env.APP_CONFIG;
  });
});

describe('load config w/ one file extends', () => {
  const files: [string, string][] = [
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
  ];

  const expected = {
    foo: {
      bar: 'baz',
    },
    baz: {
      bar: 'foo',
    },
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});

describe('load config w/ multiple file extends', () => {
  const files: [string, string][] = [
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
  ];

  const expected = {
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
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});

describe('extending from env var', () => {
  const files: [string, string][] = [
    [
      'app-config.yml',
      `
      nested:
        baz: 2
      `,
    ],
    [
      'app-config.secrets.yml',
      `
      nested:
        secret: 'password'
      `,
    ],
  ];

  beforeEach(() => {
    process.env.APP_CONFIG_EXTEND = `
      nested:
        baz: 1
    `;
  });

  afterEach(() => {
    delete process.env.APP_CONFIG_EXTEND;
  });

  const expectedSecrets = {
    nested: { secret: 'password' },
  };

  const expectedConfig = {
    nested: {
      baz: 1,
      secret: 'password',
    },
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual(expectedSecrets);
    expect(config).toEqual(expectedConfig);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual(expectedSecrets);
    expect(config).toEqual(expectedConfig);
  }));
});

describe('extending secret from env var', () => {
  const files: [string, string][] = [
    [
      'app-config.yml',
      `
      nested:
        baz: 2
      `,
    ],
    [
      'app-config.secrets.yml',
      `
      nested:
        secret: 'password'
      `,
    ],
  ];

  beforeEach(() => {
    process.env.APP_CONFIG_EXTEND = `
      nested:
        secret: 'other password'
    `;
  });

  afterEach(() => {
    delete process.env.APP_CONFIG_EXTEND;
  });

  const expectedSecrets = {
    nested: { secret: 'other password' },
  };

  const expectedConfig = {
    nested: {
      baz: 2,
      secret: 'other password',
    },
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual(expectedSecrets);
    expect(config).toEqual(expectedConfig);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual(expectedSecrets);
    expect(config).toEqual(expectedConfig);
  }));
});

describe('extending from env var without nesting', () => {
  const files: [string, string][] = [
    [
      'app-config.yml',
      `
      baz: 2
      `,
    ],
    [
      'app-config.secrets.yml',
      `
      secret: 'password'
      `,
    ],
  ];

  beforeEach(() => {
    process.env.APP_CONFIG_EXTEND = `
      baz: 1
    `;
  });

  afterEach(() => {
    delete process.env.APP_CONFIG_EXTEND;
  });

  const expectedSecrets = {
    secret: 'password',
  };

  const expectedConfig = {
    baz: 1,
    secret: 'password',
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual(expectedSecrets);
    expect(config).toEqual(expectedConfig);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual(expectedSecrets);
    expect(config).toEqual(expectedConfig);
  }));
});
