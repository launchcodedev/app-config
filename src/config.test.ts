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

describe('load env override files', () => {
  // Using qa because that wouldn't be picked up by default
  const files: [string, string][] = [
    [
      'custom-name.qa.yml',
      'env: qa',
    ],
    [
      'custom-name.staging.yml',
      'env: staging',
    ],
    [
      'custom-name.prod.yml',
      'env: prod',
    ],
  ];

  const expected = {
    env: 'qa',
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const {
      config,
      secrets,
      fileType,
      source,
    } = await loadConfig(dir, { fileNameOverride: 'custom-name', envOverride: 'qa' });

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const {
      config,
      secrets,
      fileType,
      source,
    } = loadConfigSync(dir, { fileNameOverride: 'custom-name', envOverride: 'qa' });

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});

describe('load env override files', () => {
  // Using qa because that wouldn't be picked up by default
  const files: [string, string][] = [
    [
      'custom-name.yml',
      `foo:
        $env:
          default: 0
          qa: 1
          staging: 2
          prod: 3
      `,
    ],
  ];

  const expected = {
    foo: 1,
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const {
      config,
      secrets,
      fileType,
      source,
    } = await loadConfig(dir, { fileNameOverride: 'custom-name', envOverride: 'qa' });

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const {
      config,
      secrets,
      fileType,
      source,
    } = loadConfigSync(dir, { fileNameOverride: 'custom-name', envOverride: 'qa' });

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});

describe('load env override from within extends', () => {
  // Using qa because that wouldn't be picked up by default
  const files: [string, string][] = [
    [
      'custom-name.yml',
      `app-config:
         extends: foo.yml
      `,
    ],
    [
      'foo.yml',
      `foo:
        $env:
          default: 0
          qa: 1
          staging: 2
          prod: 3
      `,
    ],
  ];

  const expected = {
    foo: 1,
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const {
      config,
      secrets,
      fileType,
      source,
    } = await loadConfig(dir, { fileNameOverride: 'custom-name', envOverride: 'qa' });

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const {
      config,
      secrets,
      fileType,
      source,
    } = loadConfigSync(dir, { fileNameOverride: 'custom-name', envOverride: 'qa' });

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});

describe('load custom named yaml config file', () => {
  const files: [string, string][] = [
    [
      'custom-name.yml',
      `
      nested:
        baz: 2
      `,
    ],
    [
      'custom-name.secrets.yml',
      'foo: bar',
    ],
  ];

  const expected = {
    nested: { baz: 2 },
    foo: 'bar',
  };

  const expectedSecrets = {
    foo: 'bar',
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const {
      config,
      secrets,
      fileType,
      source,
    } = await loadConfig(dir, { fileNameOverride: 'custom-name' });

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual(expectedSecrets);
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const {
      config,
      secrets,
      fileType,
      source,
    } = await loadConfig(dir, { fileNameOverride: 'custom-name' });

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual(expectedSecrets);
    expect(config).toEqual(expected);
  }));
});

describe('load hidden custom named yaml config file', () => {
  const files: [string, string][] = [
    [
      '.custom-name.yml',
      `
      nested:
        baz: 2
      `,
    ],
    [
      '.custom-name.secrets.yml',
      'foo: bar',
    ],
  ];

  const expected = {
    nested: { baz: 2 },
    foo: 'bar',
  };

  const expectedSecrets = {
    foo: 'bar',
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const {
      config,
      secrets,
      fileType,
      source,
    } = await loadConfig(dir, { fileNameOverride: 'custom-name' });

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual(expectedSecrets);
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const {
      config,
      secrets,
      fileType,
      source,
    } = await loadConfig(dir, { fileNameOverride: 'custom-name' });

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual(expectedSecrets);
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
    expect(fileType).toBe(FileType.JSON5);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.JSON5);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});

describe('config file source', () => {
  const files: [string, string][] = [
    ['app-config.json5', '{}'],
  ];

  test('async', () => withFakeFiles(files, async (dir) => {
    const { fileSource, fileType } = await loadConfig(dir);

    expect(fileSource).toBe(join(dir, 'app-config.json5'));
    expect(fileType).toBe(FileType.JSON5);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { fileSource, fileType } = loadConfigSync(dir);

    expect(fileSource).toBe(join(dir, 'app-config.json5'));
    expect(fileType).toBe(FileType.JSON5);
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

describe('load env config and secrets w/ file extends', () => {
  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  const files: [string, string][] = [
    [
      '.app-config.prod.toml',
      `
      [app-config]
      extends = '.app-config.toml'

      [foo]
      bar = "baz"
      `,
    ],
    [
      '.app-config.toml',
      `
      [foo]
      bar = "foo1"
      baz = "foo2"
      `,
    ],
    [
      '.app-config.secrets.prod.toml',
      `
      [app-config]
      extends = '.app-config.secrets.toml'

      [foo]
      secret = "new secret"
      `,
    ],
    [
      '.app-config.secrets.toml',
      `
      [foo]
      secret = "secret"
      extra = "extra"
      `,
    ],
  ];

  const expected = {
    foo: {
      bar: 'baz',
      baz: 'foo2',
    },
  };

  const expectedSecrets = {
    foo: {
      secret: 'new secret',
      extra: 'extra',
    },
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    process.env.NODE_ENV = 'production';
    const { nonSecrets, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual(expectedSecrets);
    expect(nonSecrets).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    process.env.NODE_ENV = 'production';
    const { nonSecrets, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.TOML);
    expect(secrets).toEqual(expectedSecrets);
    expect(nonSecrets).toEqual(expected);
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

describe('extending blank config from env var', () => {
  const files: [string, string][] = [
    [
      'app-config.yml',
      '',
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

  const expectedConfig = {
    nested: {
      baz: 1,
    },
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(config).toEqual(expectedConfig);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
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

describe('load environment specific config', () => {
  const envFiles: { env: string, files: [string, string][], expected: { env: string } }[] = [
    {
      env: 'test',
      files: [
        [
          '.app-config.test.toml',
          'env = "test"',
        ],
      ],
      expected: { env: 'test' },
    },
    {
      env: 'development',
      files: [
        [
          '.app-config.development.toml',
          'env = "dev"',
        ],
      ],
      expected: { env: 'dev' },
    },
    {
      env: 'staging',
      files: [
        [
          '.app-config.staging.toml',
          'env = "staging"',
        ],
      ],
      expected: { env: 'staging' },
    },
    {
      env: 'production',
      files: [
        [
          '.app-config.production.toml',
          'env = "prod"',
        ],
      ],
      expected: { env: 'prod' },
    },
  ];

  const OLD_ENV = process.env;

  afterAll(() => {
    process.env = OLD_ENV;
  });

  envFiles.forEach(({ env, files, expected }) => {
    test('async', () => withFakeFiles(files, async (dir) => {
      process.env.NODE_ENV = env;
      const { config, secrets, fileType, source } = await loadConfig(dir);

      expect(source).toBe(ConfigSource.File);
      expect(fileType).toBe(FileType.TOML);
      expect(secrets).toEqual({});
      expect(config).toEqual(expected);
    }));

    test('sync', () => withFakeFiles(files, async (dir) => {
      process.env.NODE_ENV = env;
      const { config, secrets, fileType, source } = loadConfigSync(dir);

      expect(source).toBe(ConfigSource.File);
      expect(fileType).toBe(FileType.TOML);
      expect(secrets).toEqual({});
      expect(config).toEqual(expected);
    }));
  });
});

describe('load environment specific config with alias', () => {
  const envFiles: { env: string, files: [string, string][], expected: { env: string } }[] = [
    {
      env: 'development',
      files: [
        [
          '.app-config.dev.toml',
          'env = "dev"',
        ],
      ],
      expected: { env: 'dev' },
    },
    {
      env: 'production',
      files: [
        [
          '.app-config.prod.toml',
          'env = "prod"',
        ],
      ],
      expected: { env: 'prod' },
    },
  ];

  const OLD_ENV = process.env;

  afterAll(() => {
    process.env = OLD_ENV;
  });

  envFiles.forEach(({ env, files, expected }) => {
    test('async', () => withFakeFiles(files, async (dir) => {
      process.env.NODE_ENV = env;
      const { config, secrets, fileType, source } = await loadConfig(dir);

      expect(source).toBe(ConfigSource.File);
      expect(fileType).toBe(FileType.TOML);
      expect(secrets).toEqual({});
      expect(config).toEqual(expected);
    }));

    test('sync', () => withFakeFiles(files, async (dir) => {
      process.env.NODE_ENV = env;
      const { config, secrets, fileType, source } = loadConfigSync(dir);

      expect(source).toBe(ConfigSource.File);
      expect(fileType).toBe(FileType.TOML);
      expect(secrets).toEqual({});
      expect(config).toEqual(expected);
    }));
  });
});

describe('load environment specific config with secrets', () => {
  const envFiles: {
    env: string,
    files: [string, string][],
    expected: { env: string, secret: string },
  }[] = [
    {
      env: 'test',
      files: [
        [
          '.app-config.test.toml',
          'env = "test"',
        ],
        [
          '.app-config.secrets.test.toml',
          'secret = "test"',
        ],
      ],
      expected: { env: 'test', secret: 'test' },
    },
    {
      env: 'development',
      files: [
        [
          '.app-config.development.toml',
          'env = "dev"',
        ],
        [
          '.app-config.secrets.development.toml',
          'secret = "dev"',
        ],
      ],
      expected: { env: 'dev', secret: 'dev' },
    },
    {
      env: 'staging',
      files: [
        [
          '.app-config.staging.toml',
          'env = "staging"',
        ],
        [
          '.app-config.secrets.staging.toml',
          'secret = "staging"',
        ],
      ],
      expected: { env: 'staging', secret: 'staging' },
    },
    {
      env: 'production',
      files: [
        [
          '.app-config.production.toml',
          'env = "prod"',
        ],
        [
          '.app-config.secrets.production.toml',
          'secret = "production"',
        ],
      ],
      expected: { env: 'prod', secret: 'production' },
    },
  ];

  const OLD_ENV = process.env;

  afterAll(() => {
    process.env = OLD_ENV;
  });

  envFiles.forEach(({ env, files, expected }) => {
    test('async', () => withFakeFiles(files, async (dir) => {
      process.env.NODE_ENV = env;
      const { config, secrets, fileType, source } = await loadConfig(dir);

      expect(source).toBe(ConfigSource.File);
      expect(fileType).toBe(FileType.TOML);
      expect(secrets).toEqual({ secret: expected.secret });
      expect(config).toEqual(expected);
    }));

    test('sync', () => withFakeFiles(files, async (dir) => {
      process.env.NODE_ENV = env;
      const { config, secrets, fileType, source } = loadConfigSync(dir);

      expect(source).toBe(ConfigSource.File);
      expect(fileType).toBe(FileType.TOML);
      expect(secrets).toEqual({ secret: expected.secret });
      expect(config).toEqual(expected);
    }));
  });
});

describe('load environment specific config with alternate env variables', () => {
  const envs = ['NODE_ENV', 'ENV', 'APP_CONFIG_ENV'];
  const files: [string, string][] = [
    [
      '.app-config.prod.yml',
      `
      foo: bar
      `,
    ],
  ];

  const expected = {
    foo: 'bar',
  };

  const OLD_ENV = process.env;

  afterAll(() => {
    process.env = OLD_ENV;
  });

  envs.forEach((envName) => {
    test('async', () => withFakeFiles(files, async (dir) => {
      process.env[envName] = 'production';
      const { config, secrets, fileType, source } = await loadConfig(dir);

      expect(source).toBe(ConfigSource.File);
      expect(fileType).toBe(FileType.YAML);
      expect(secrets).toEqual({});
      expect(config).toEqual(expected);
    }));
  });

  envs.forEach((envName) => {
    test('sync', () => withFakeFiles(files, async (dir) => {
      process.env[envName] = 'production';
      const { config, secrets, fileType, source } = loadConfigSync(dir);

      expect(source).toBe(ConfigSource.File);
      expect(fileType).toBe(FileType.YAML);
      expect(secrets).toEqual({});
      expect(config).toEqual(expected);
    }));
  });
});

describe('extending with env', () => {
  beforeEach(() => {
    process.env.BAZ = 'supersecret';

    process.env.APP_CONFIG_EXTEND = `
      nested:
        baz: $\{BAZ\}
    `;
  });

  afterEach(() => {
    delete process.env.BAZ;
    delete process.env.APP_CONFIG_EXTEND;
  });

  const files: [string, string][] = [
    [
      'app-config.yml',
      `
      nested:
        baz: 2
      `,
    ],
  ];

  const expectedConfig = {
    nested: {
      baz: 'supersecret',
    },
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(config).toEqual(expectedConfig);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(config).toEqual(expectedConfig);
  }));
});
