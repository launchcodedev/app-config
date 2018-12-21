import { ConfigSource } from './config';
import { FileType } from './file-loader';
import {
  InvalidConfig,
  validate,
  loadSchema,
  loadSchemaSync,
  loadValidated,
  loadValidatedSync,
} from './schema';
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

describe('load json schema', () => {
  const content = `
    {
      "properties": {
        "x": { "type": "number" }
      }
    }
  `;

  const expected = {
    properties: {
      x: {
        type: 'number',
      },
    },
  };

  test('async', () => withFakeFiles([
    [ 'app-config.schema.json', content ],
  ], async (dir) => {
    expect(await loadSchema(dir)).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    [ 'app-config.schema.json', content ],
  ], async (dir) => {
    expect(loadSchemaSync(dir)).toEqual(expected);
  }));
});

describe('load toml schema', () => {
  const content = `
    [properties.x]
    type = "number"
  `;

  const expected = {
    properties: {
      x: {
        type: 'number',
      },
    },
  };

  test('async', () => withFakeFiles([
    [ 'app-config.schema.toml', content ],
  ], async (dir) => {
    expect(await loadSchema(dir)).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    [ 'app-config.schema.toml', content ],
  ], async (dir) => {
    expect(loadSchemaSync(dir)).toEqual(expected);
  }));
});

describe('load yaml schema', () => {
  const content = `
    properties:
      x:
        type: number
  `;

  const expected = {
    properties: {
      x: {
        type: 'number',
      },
    },
  };

  test('async', () => withFakeFiles([
    [ 'app-config.schema.yml', content ],
  ], async (dir) => {
    expect(await loadSchema(dir)).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    [ 'app-config.schema.yml', content ],
  ], async (dir) => {
    expect(loadSchemaSync(dir)).toEqual(expected);
  }));
});

describe('load extends', () => {
  test('async', () => withFakeFiles([
    [
      'app-config.schema.json',
      `
      {
        "app-config": {
          "extends": "other-file.yml"
        },
        "properties": {
          "x": { "type": "number" }
        }
      }
      `,
    ],
    [
      'other-file.yml',
      `
      properties:
        y:
          type: number
      `,
    ],
  ], async (dir) => {
    expect(await loadSchema(dir)).toEqual({
      properties: {
        x: { type: 'number' },
        y: { type: 'number' },
      },
    });
  }));
});

test('load validated', async () => {
  await withFakeFiles([
    [
      '.app-config.schema.json',
      `
      {
        "required": ["x"],
        "properties": {
          "x": { "type": "number" }
        }
      }
      `,
    ],
    [
      '.app-config.yml',
      `
      x: 1
      `,
    ],
  ], async (dir) => {
    await loadValidated(dir);
  });

  await withFakeFiles([
    [
      '.app-config.schema.json',
      `
      {
        "required": ["x"],
        "properties": {
          "x": { "type": "number" }
        }
      }
      `,
    ],
    [
      '.app-config.yml',
      `
      y: 1
      `,
    ],
  ], async (dir) => {
    await expect(loadValidated(dir)).rejects.toThrow();
  });
});

test('load validated sync', async () => {
  await withFakeFiles([
    [
      '.app-config.schema.json',
      `
      {
        "required": ["x"],
        "properties": {
          "x": { "type": "number" }
        }
      }
      `,
    ],
    [
      '.app-config.yml',
      `
      x: 1
      `,
    ],
  ], async (dir) => {
    loadValidatedSync(dir);
  });

  await withFakeFiles([
    [
      '.app-config.schema.json',
      `
      {
        "required": ["x"],
        "properties": {
          "x": { "type": "number" }
        }
      }
      `,
    ],
    [
      '.app-config.yml',
      `
      y: 1
      `,
    ],
  ], async (dir) => {
    expect(() => loadValidatedSync(dir)).toThrow();
  });
});

test('schema ref to other file', async () => {
  await withFakeFiles([
    [
      'app-config.schema.yml',
      `
      required: [x, y, z]
      properties:
        x: { $ref: 'other.schema.yml#/Nested' }
        y: { $ref: 'other.schema.yml' }
        z: { $ref: '#/definitions/N' }
      definitions:
        N: { type: string }
      `,
    ],
    [
      'other.schema.yml',
      `
      properties:
        x: { $ref: '#/Nested' }
      Nested:
        type: number
      `,
    ],
    [
      '.app-config.yml',
      `
      x: 1
      y:
        x: 2
      z: string
      `,
    ],
  ], async (dir) => {
    await loadValidated(dir);
  });
});

test('schema ref to other file sync', async () => {
  await withFakeFiles([
    [
      'app-config.schema.yml',
      `
      required: [x, y, z]
      properties:
        x: { $ref: 'other.schema.yml#/Nested' }
        y: { $ref: 'other.schema.yml' }
        z: { $ref: '#/definitions/N' }
      definitions:
        N: { type: string }
      `,
    ],
    [
      'other.schema.yml',
      `
      properties:
        x: { $ref: '#/Nested' }
      Nested:
        type: number
      `,
    ],
    [
      '.app-config.yml',
      `
      x: 1
      y:
        x: 2
      z: string
      `,
    ],
  ], async (dir) => {
    loadValidatedSync(dir);
  });
});

test('schema relative ref to other file', async () => {
  await withFakeFiles([
    [
      'nested-folder/app-config.schema.yml',
      `
      required: [x]
      properties:
        x: { $ref: '../rootlevel.schema.yml#/Nested' }
      `,
    ],
    [
      'nested-folder/app-config.yml',
      `
      x: 1
      `,
    ],
    [
      'rootlevel.schema.yml',
      `
      Nested:
        type: number
      `,
    ],
  ], async (dir) => {
    await loadValidated(`${dir}/nested-folder`);
  });
});

test('schema relative ref to nested folder', async () => {
  await withFakeFiles([
    [
      'app-config.schema.yml',
      `
      required: [x]
      properties:
        x: { $ref: 'nested/other.schema.yml#/Nested' }
      `,
    ],
    [
      'nested/other.schema.yml',
      `
      Nested:
        type: number
      `,
    ],
    [
      'app-config.yml',
      `
      x: 1
      `,
    ],
  ], async (dir) => {
    await loadValidated(dir);
  });

  await withFakeFiles([
    [
      'app-config.schema.yml',
      `
      required: [x]
      properties:
        x: { $ref: 'nested/other.schema.yml' }
      `,
    ],
    [
      'nested/other.schema.yml',
      `
      type: number
      `,
    ],
    [
      'app-config.yml',
      `
      x: 1
      `,
    ],
  ], async (dir) => {
    await loadValidated(dir);
  });

  await withFakeFiles([
    [
      'app-config.schema.yml',
      `
      required: [x]
      properties:
        x: { $ref: './nested/other.schema.yml' }
      `,
    ],
    [
      'nested/other.schema.yml',
      `
      type: number
      `,
    ],
    [
      'app-config.yml',
      `
      x: 1
      `,
    ],
  ], async (dir) => {
    await loadValidated(dir);
  });
});

test('schema relative ref to double parent file', async () => {
  await withFakeFiles([
    [
      'a/nested-folder/app-config.schema.yml',
      `
      required: [x]
      properties:
        x: { $ref: '../../rootlevel.schema.yml#/Nested' }
      `,
    ],
    [
      'a/nested-folder/app-config.yml',
      `
      x: 1
      `,
    ],
    [
      'rootlevel.schema.yml',
      `
      Nested:
        type: number
      `,
    ],
  ], async (dir) => {
    await loadValidated(`${dir}/a/nested-folder`);
  });
});

test('schema ref recursion', async () => {
  await withFakeFiles([
    [
      'a/nested-folder/app-config.schema.yml',
      `
      required: [x]
      properties:
        x: { $ref: '../../rootlevel.schema.yml#/Nested' }
      `,
    ],
    [
      'a/nested-folder/app-config.yml',
      `
      x: 1
      `,
    ],
    [
      'rootlevel.schema.yml',
      `
      Nested:
        type: { $ref: './b/nested/schema.yml' }
      `,
    ],
    [
      'b/nested/schema.yml',
      `
      required: [x]
      properties:
        x: { type: "number" }
      `,
    ],
  ], async (dir) => {
    await loadValidated(`${dir}/a/nested-folder`);
  });
});
