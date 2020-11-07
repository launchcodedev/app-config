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

describe('Schema References', () => {});

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
