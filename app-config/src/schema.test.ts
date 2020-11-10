import { JsonObject } from './common';
import { ParsedValue } from './parsed-value';
import { generateSymmetricKey, encryptValue } from './encryption';
import { encryptedDirective } from './extensions';
import { loadSchema } from './schema';
import { withTempFiles } from './test-util';

describe('Schema Loading', () => {
  it('fails when no schema is present', async () => {
    await expect(loadSchema()).rejects.toThrow();
  });

  it('loads a simple schema', async () => {
    await withTempFiles(
      {
        '.app-config.schema.yml': `
          type: object
          properties:
            foo: { type: string }
        `,
      },
      async (inDir) => {
        const { value } = await loadSchema({ directory: inDir('.') });

        expect(value).toMatchObject({
          type: 'object',
          properties: {
            foo: { type: 'string' },
          },
        });
      },
    );
  });

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
});

describe('Schema References', () => {
  it('loads a schema $ref relative to itself', async () => {
    await withTempFiles(
      {
        'nested-folder/.app-config.schema.yml': `
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
        await loadSchema({ directory: inDir('a') });
        await loadSchema({ directory: inDir('b') });
      },
    );
  });
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
});
