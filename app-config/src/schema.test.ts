import { JsonObject } from './common';
import { ParsedValue } from './parsed-value';
import { generateSymmetricKey, encryptValue } from './encryption';
import { encryptedDirective, extendsDirective, envDirective } from './extensions';
import { loadSchema } from './schema';
import { withTempFiles } from './test-util';

describe('Schema Loading', () => {
  it('fails when no schema is present', async () => {
    await expect(loadSchema()).rejects.toThrow();
  });

  it('loads schema from APP_CONFIG_SCHEMA variable', async () => {
    process.env.APP_CONFIG_SCHEMA = JSON.stringify({
      type: 'object',
      properties: { foo: { type: 'string' } },
    });

    const { schema: value } = await loadSchema();

    expect(value).toMatchObject({
      type: 'object',
      properties: { foo: { type: 'string' } },
    });
  });

  it('loads a simple YAML schema', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `
          type: object
          properties:
            foo: { type: string }
        `,
      },
      async (inDir) => {
        const { schema: value } = await loadSchema({ directory: inDir('.') });

        expect(value).toMatchObject({
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
        });
      },
    );
  });

  it('loads a simple JSON schema', async () => {
    await withTempFiles(
      {
        '.app-config.schema.json': `{
          "type": "object",
          "properties": {
            "foo": { "type": "string" }
          }
        }`,
      },
      async (inDir) => {
        const { schema: value } = await loadSchema({ directory: inDir('.') });

        expect(value).toMatchObject({
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
        });
      },
    );
  });

  it('loads a simple JSON5 schema', async () => {
    await withTempFiles(
      {
        '.app-config.schema.json5': `{
          type: "object",
          properties: {
            foo: { type: "string" },
          },
        }`,
      },
      async (inDir) => {
        const { schema: value } = await loadSchema({ directory: inDir('.') });

        expect(value).toMatchObject({
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
        });
      },
    );
  });

  it('loads a simple TOML schema', async () => {
    await withTempFiles(
      {
        '.app-config.schema.toml': `
          type = "object"

          [properties]
          foo = { type = "string" }
        `,
      },
      async (inDir) => {
        const { schema: value } = await loadSchema({ directory: inDir('.') });

        expect(value).toMatchObject({
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
        });
      },
    );
  });

  it('loads a schema with $extends directive when given', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `
          type: object
          properties:
            foo: { $extends: ./ref.yml }
        `,
        'ref.yml': `
          type: string
        `,
      },
      async (inDir) => {
        const { schema: value } = await loadSchema({
          directory: inDir('.'),
          parsingExtensions: [extendsDirective()],
        });

        expect(value).toMatchObject({
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
        });
      },
    );
  });

  describe('References', () => {
    it('resolves schema $ref to a TOML file', async () => {
      await withTempFiles(
        {
          '.app-config.schema.yml': `
            type: object
            properties:
              a:
                $ref: './referenced.schema.toml#/definitions/A'
          `,
          'referenced.schema.toml': `
            [definitions]
            A = { "type" = "number" }
          `,
        },
        async (inDir) => {
          const { schema } = await loadSchema({ directory: inDir('.') });

          expect(schema.properties).toEqual({ a: { type: 'number' } });
        },
      );
    });

    it('resolves schema $ref to a JSON file', async () => {
      await withTempFiles(
        {
          '.app-config.schema.yml': `
            type: object
            properties:
              a:
                $ref: './referenced.schema.json#/definitions/A'
          `,
          'referenced.schema.json': `{
            "definitions": {
              "A": { "type": "number" }
            }
          }`,
        },
        async (inDir) => {
          const { schema } = await loadSchema({ directory: inDir('.') });

          expect(schema.properties).toEqual({ a: { type: 'number' } });
        },
      );
    });

    it('resolves schema $ref to a JSON5 file', async () => {
      await withTempFiles(
        {
          '.app-config.schema.yml': `
            type: object
            properties:
              a:
                $ref: './referenced.schema.json5#/definitions/A'
          `,
          'referenced.schema.json5': `{
            definitions: {
              A: { type: "number" }
            }
          }`,
        },
        async (inDir) => {
          const { schema } = await loadSchema({ directory: inDir('.') });

          expect(schema.properties).toEqual({ a: { type: 'number' } });
        },
      );
    });

    it('resolves schema $ref to a YAML file', async () => {
      await withTempFiles(
        {
          '.app-config.schema.yml': `
            type: object
            properties:
              a:
                $ref: './referenced.schema.yaml#/definitions/A'
          `,
          'referenced.schema.yaml': `
            definitions:
              A: { type: 'number' }
          `,
        },
        async (inDir) => {
          const { schema } = await loadSchema({ directory: inDir('.') });

          expect(schema.properties).toEqual({ a: { type: 'number' } });
        },
      );
    });

    it('loads a schema $ref relative to itself', async () => {
      await withTempFiles(
        {
          'nested-folder/.app-config.schema.yml': `
            type: object
            required: [x]
            properties:
              x: { $ref: '../rootlevel.schema.yml#/Nested' }
          `,
          'rootlevel.schema.yml': `
            Nested:
              type: number
          `,
        },
        async (inDir) => {
          await loadSchema({ directory: inDir('nested-folder') });
        },
      );
    });

    it("loads a schema $ref relative to the file it's in", async () => {
      await withTempFiles(
        {
          'nested-folder/.app-config.schema.yml': `
            type: object
            required: [x]
            properties:
              x: { $ref: '../nested-folder-2/rootlevel.schema.yml#/definitions/Nested' }
          `,
          'nested-folder-2/rootlevel.schema.yml': `
            definitions:
              Nested: { $ref: '../nested-folder-3/.app-config.schema.yml#/definitions/Nested2' }
          `,
          'nested-folder-3/.app-config.schema.yml': `
            definitions:
              Nested2:
                type: string
          `,
        },
        async (inDir) => {
          await loadSchema({ directory: inDir('nested-folder') });
        },
      );
    });

    it('resolves multiple schema $ref properties to the same schema', async () => {
      await withTempFiles(
        {
          '.app-config.schema.yml': `
            type: object
            properties:
              a:  { $ref: './referenced.schema.yml#/definitions/A' }
              aa: { $ref: './referenced.schema.yml#/definitions/A' }
              b:  { $ref: './referenced.schema.yml#/definitions/B' }
          `,
          'referenced.schema.yml': `
            definitions:
              A: { type: number }
              B: { type: number }
          `,
        },
        async (inDir) => {
          await loadSchema({ directory: inDir('.') });
        },
      );
    });

    it('resolves schema $ref properties that appear in arrays', async () => {
      await withTempFiles(
        {
          '.app-config.schema.yml': `
            type: object
            properties:
              a:
                oneOf:
                  - { $ref: './referenced.schema.yml#/definitions/A' }
                  - { $ref: './referenced.schema.yml#/definitions/B' }
          `,
          'referenced.schema.yml': `
            definitions:
              A: { type: number }
              B: { type: number }
          `,
        },
        async (inDir) => {
          await loadSchema({ directory: inDir('.') });
        },
      );
    });

    it('handles circular references', async () => {
      await withTempFiles(
        {
          'a/.app-config.schema.yml': `
            type: object
            properties:
              x: { $ref: '../b/.app-config.schema.yml#/definitions/B' }
            definitions:
              A: { type: string }
          `,
          'b/.app-config.schema.yml': `
            type: object
            properties:
              x: { $ref: '../a/.app-config.schema.yml#/definitions/A' }
            definitions:
              B: { type: string }
          `,
        },
        async (inDir) => {
          const { schema: a } = await loadSchema({ directory: inDir('a') });
          const { schema: b } = await loadSchema({ directory: inDir('b') });

          expect(a).toMatchObject({
            properties: {
              x: {
                type: 'string',
              },
            },
          });

          expect(b).toMatchObject({
            properties: {
              x: {
                type: 'string',
              },
            },
          });
        },
      );
    });

    it('handles schema ref filepath with space in filepath', async () => {
      await withTempFiles(
        {
          '.app-config.schema.yml': `
            type: object
            properties:
              x: { $ref: 'my schema.yml#/definitions/B' }
          `,
          'my schema.yml': `
            type: object
            definitions:
              B: { type: string }
          `,
        },
        async (inDir) => {
          const { schema: value } = await loadSchema({ directory: inDir('.') });

          expect(value).toMatchObject({
            properties: {
              x: {
                type: 'string',
              },
            },
          });
        },
      );
    });
  });
});

describe('Validation', () => {
  it('validates properties', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `
          type: object
          required: [foo]
          properties:
            foo: { type: string }
        `,
      },
      async (inDir) => {
        const { validate } = await loadSchema({ directory: inDir('.') });

        expect(() => validate({})).toThrow();
        expect(() => validate({ foo: true })).toThrow();
        expect(() => validate({ foo: '' })).not.toThrow();
      },
    );
  });

  describe('Secrets', () => {
    it('detects when secrets are in nonSecrets', async () => {
      await withTempFiles(
        {
          '.app-config.schema.yml': `
          type: object
          properties:
            foo: { type: string }
            bar: { type: string, secret: true }
        `,
        },
        async (inDir) => {
          const { validate } = await loadSchema({ directory: inDir('.') });

          expect(() => validate({ foo: '', bar: '' })).not.toThrow();
          expect(() => validate({ foo: '', bar: '' }, ParsedValue.literal({}))).not.toThrow();
          expect(() => validate({ foo: '', bar: '' }, ParsedValue.literal({ bar: '' }))).toThrow();
          expect(() =>
            // it's okay here to put foo in nonSecrets
            validate({ foo: '', bar: '' }, ParsedValue.literal({ foo: '' })),
          ).not.toThrow();
        },
      );
    });

    it('detects when secrets are in nonSecrets in a nested structure', async () => {
      await withTempFiles(
        {
          '.app-config.schema.yml': `
          type: object
          properties:
            user:
              type: object
              properties:
                login:
                  type: object
                  properties:
                    password:
                      type: string
                      secret: true
        `,
        },
        async (inDir) => {
          const { validate } = await loadSchema({ directory: inDir('.') });

          expect(() =>
            validate({ user: { login: { password: 'pwd' } } }, ParsedValue.literal({})),
          ).not.toThrow();

          expect(() =>
            validate(
              { user: { login: { password: 'pwd' } } },
              // the secret was present in nonSecrets
              ParsedValue.literal({ user: { login: { password: 'pwd' } } }),
            ),
          ).toThrow();
        },
      );
    });

    it('allows encrypted values in nonSecrets when marked as secret in schema', async () => {
      await withTempFiles(
        {
          '.app-config.schema.yml': `
          type: object
          properties:
            foo: { type: string, secret: true }
        `,
        },
        async (inDir) => {
          const { validate } = await loadSchema({ directory: inDir('.') });
          const symmetricKey = await generateSymmetricKey(1);

          const parsed = await ParsedValue.parseLiteral(
            {
              // we've put foo in nonSecrets, but it should be allowed because it's encrypted
              foo: await encryptValue('hello world', symmetricKey),
            },
            [encryptedDirective(symmetricKey)],
          );

          validate(parsed.toJSON() as JsonObject, parsed);
        },
      );
    });

    it('allows encrypted values in nonSecrets when in an array', async () => {
      await withTempFiles(
        {
          '.app-config.schema.yml': `
          type: array
          items:
            type: string
            secret: true
        `,
        },
        async (inDir) => {
          const { validate } = await loadSchema({ directory: inDir('.') });
          const symmetricKey = await generateSymmetricKey(1);

          const parsed = await ParsedValue.parseLiteral(
            [
              await encryptValue('secret-1', symmetricKey),
              await encryptValue('secret-2', symmetricKey),
            ],
            [encryptedDirective(symmetricKey)],
          );

          validate(parsed.toJSON() as JsonObject, parsed);
        },
      );
    });

    it('disallows one unencrypted value in nonSecrets when in an array', async () => {
      await withTempFiles(
        {
          '.app-config.schema.yml': `
          type: array
          items:
            type: string
            secret: true
        `,
        },
        async (inDir) => {
          const { validate } = await loadSchema({ directory: inDir('.') });
          const symmetricKey = await generateSymmetricKey(1);

          const parsed = await ParsedValue.parseLiteral(
            [
              await encryptValue('secret-1', symmetricKey),
              'not-so-secret',
              await encryptValue('secret-2', symmetricKey),
            ],
            [encryptedDirective(symmetricKey)],
          );

          expect(() => validate(parsed.toJSON() as JsonObject, parsed)).toThrow();
        },
      );
    });

    it('allows a "secret" array with all secret values, but not secret itself', async () => {
      await withTempFiles(
        {
          '.app-config.schema.yml': `
          type: object
          properties:
            foo:
              type: array
              secret: true
              items:
                type: string
        `,
        },
        async (inDir) => {
          const { validate } = await loadSchema({ directory: inDir('.') });
          const symmetricKey = await generateSymmetricKey(1);

          const parsed = await ParsedValue.parseLiteral(
            {
              foo: [await encryptValue('secret-1', symmetricKey)],
            },
            [encryptedDirective(symmetricKey), envDirective()],
          );

          validate(parsed.toJSON() as JsonObject, parsed);
        },
      );
    });
  });
});
