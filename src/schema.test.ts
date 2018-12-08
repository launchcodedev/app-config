import { validate, ConfigSource, InvalidConfig } from './schema';

test('parse schema', () => {
  const res = validate({
    schema: {
      type: 'object',
      required: [ 'foo' ],
      properties: {
        foo: { type: 'number' }
      },
    },
    source: ConfigSource.File,
    config: {
      foo: 1,
    },
  });

  expect(res).toBe(false);
});

test('invalid schema', () => {
  const res = validate({
    schema: {
      type: 'object',
      required: [ 'foo' ],
      properties: {
        foo: { type: 'number' }
      },
    },
    source: ConfigSource.File,
    // does not contain foo
    config: {},
  });

  expect((<any>res)[0]).toBe(InvalidConfig.SchemaValidation);
});

test('secret property in secret file', () => {
  const res = validate({
    schema: {
      type: 'object',
      required: [ 'password' ],
      properties: {
        password: {
          type: 'string',
          secret: true,
        }
      },
    },
    source: ConfigSource.File,
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
      required: [ 'password' ],
      properties: {
        password: {
          type: 'string',
          secret: true,
        }
      },
    },
    source: ConfigSource.File,
    nonSecrets: {
      password: 'pwd',
    },
  });

  expect((<any>res)[0]).toBe(InvalidConfig.SecretInNonSecrets);
});

test('secret in env var', () => {
  const res = validate({
    schema: {
      type: 'object',
      required: [ 'password' ],
      properties: {
        password: {
          type: 'string',
          secret: true,
        }
      },
    },
    source: ConfigSource.EnvVar,
    config: {
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
                }
              }
            }
          }
        }
      },
    },
    source: ConfigSource.File,
    nonSecrets: {
      user: {
        login: {
          password: 'pwd',
        },
      },
    },
  });

  expect((<any>res)[0]).toBe(InvalidConfig.SecretInNonSecrets);
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
                }
              }
            }
          }
        }
      },
    },
    source: ConfigSource.File,
    nonSecrets: {
      user: {
        login: {
          password: 'pwd',
        },
      },
    },
  });

  expect((<any>res)[0]).toBe(InvalidConfig.SecretInNonSecrets);
});
