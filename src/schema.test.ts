import { ConfigSource } from './config';
import { FileType } from './file-loader';
import { validate, InvalidConfig, loadSchema, loadSchemaSync } from './schema';
import { withFakeFiles } from './test-util';

test('parse schema', () => {
  const res = validate({
    schema: {
      type: 'object',
      required: ['foo'],
      properties: {
        foo: { type: 'number' },
      },
    },
    source: ConfigSource.File,
    fileType: FileType.JSON,
    config: {
      foo: 1,
    },
    nonSecrets: {
      foo: 1,
    },
  });

  expect(res).toBe(false);
});

test('invalid schema', () => {
  const res = validate({
    schema: {
      type: 'object',
      required: ['foo'],
      properties: {
        foo: { type: 'number' },
      },
    },
    source: ConfigSource.File,
    fileType: FileType.JSON,
    // does not contain foo
    config: {},
    nonSecrets: {},
  });

  expect((res as any)[0]).toBe(InvalidConfig.SchemaValidation);
});

test('secret property in secret file', () => {
  const res = validate({
    schema: {
      type: 'object',
      required: ['password'],
      properties: {
        password: {
          type: 'string',
          secret: true,
        },
      },
    },
    source: ConfigSource.File,
    fileType: FileType.JSON,
    config: {
      password: 'pwd',
    },
    nonSecrets: {},
    secrets: {
      password: 'pwd',
    },
  });

  expect(res).toBe(false);
});

test('secret property in main file', () => {
  const res = validate({
    schema: {
      type: 'object',
      required: ['password'],
      properties: {
        password: {
          type: 'string',
          secret: true,
        },
      },
    },
    source: ConfigSource.File,
    fileType: FileType.JSON,
    config: {
      password: 'pwd',
    },
    nonSecrets: {
      password: 'pwd',
    },
  });

  expect((res as any)[0]).toBe(InvalidConfig.SecretInNonSecrets);
});

test('secret in env var', () => {
  const res = validate({
    schema: {
      type: 'object',
      required: ['password'],
      properties: {
        password: {
          type: 'string',
          secret: true,
        },
      },
    },
    source: ConfigSource.EnvVar,
    fileType: FileType.JSON,
    config: {
      password: 'pwd',
    },
    nonSecrets: {
      password: 'pwd',
    },
  });

  expect(res).toBe(false);
});

test('deep secret property in main file', () => {
  const res = validate({
    schema: {
      type: 'object',
      properties: {
        user: {
          properties: {
            login: {
              properties: {
                password: {
                  type: 'string',
                  secret: true,
                },
              },
            },
          },
        },
      },
    },
    source: ConfigSource.File,
    fileType: FileType.JSON,
    config: {
      user: {
        login: {
          password: 'pwd',
        },
      },
    },
    nonSecrets: {
      user: {
        login: {
          password: 'pwd',
        },
      },
    },
  });

  expect((res as any)[0]).toBe(InvalidConfig.SecretInNonSecrets);
});

test('secret referenced property in main file', () => {
  const res = validate({
    schema: {
      type: 'object',
      properties: {
        user: { $ref: '#/definitions/User' },
      },
      definitions: {
        User: {
          properties: {
            login: {
              properties: {
                password: {
                  type: 'string',
                  secret: true,
                },
              },
            },
          },
        },
      },
    },
    source: ConfigSource.File,
    fileType: FileType.JSON,
    config: {
      user: {
        login: {
          password: 'pwd',
        },
      },
    },
    nonSecrets: {
      user: {
        login: {
          password: 'pwd',
        },
      },
    },
  });

  expect((res as any)[0]).toBe(InvalidConfig.SecretInNonSecrets);
});

test('load schema file', async () => {
  await withFakeFiles([
    [
      '.app-config.schema.json',
      `
      {
        "properties": {
          "x": { "type": "number" }
        }
      }
      `,
    ],
  ], async (dir) => {
    expect(await loadSchema(dir)).toEqual({
      properties: {
        x: { type: 'number' },
      },
    });
  });
});

test('load sync schema file', async () => {
  await withFakeFiles([
    [
      '.app-config.schema.json',
      `
      {
        "properties": {
          "x": { "type": "number" }
        }
      }
      `,
    ],
  ], async (dir) => {
    expect(loadSchemaSync(dir)).toEqual({
      properties: {
        x: { type: 'number' },
      },
    });
  });
});

test('load toml schema file', async () => {
  await withFakeFiles([
    [
      '.app-config.schema.toml',
      `
      [properties]
      x = { type = "number" }
      `,
    ],
  ], async (dir) => {
    expect(await loadSchema(dir)).toEqual({
      properties: {
        x: { type: 'number' },
      },
    });
  });
});

test('load yaml schema file', async () => {
  await withFakeFiles([
    [
      '.app-config.schema',
      `
      properties:
        x:
          type: 'number'
      `,
    ],
  ], async (dir) => {
    expect(await loadSchema(dir)).toEqual({
      properties: {
        x: { type: 'number' },
      },
    });
  });
});

test('load non dotfile schema file', async () => {
  await withFakeFiles([
    [
      'app-config.schema.json',
      `
      {
        "properties": {
          "x": { "type": "number" }
        }
      }
      `,
    ],
  ], async (dir) => {
    expect(await loadSchema(dir)).toEqual({
      properties: {
        x: { type: 'number' },
      },
    });
  });
});
