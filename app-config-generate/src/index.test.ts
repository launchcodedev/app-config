import { readFile } from 'fs-extra';
import { withTempFiles } from '@app-config/test-utils';
import { generateQuicktype, generateTypeFiles } from './index';

describe('TypeScript File Generation', () => {
  it('creates a simple TypeScript file', async () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        foo: { type: 'string' },
      },
    } as const;

    const generated = await generateQuicktype(schema, 'ts', 'Configuration');

    expect(generated).toMatchSnapshot();
  });

  it('creates a TypeScript file from meta file properties', async () => {
    await withTempFiles(
      {
        '.app-config.meta.json5': `{
          generate: [
            {
              file: "generated.d.ts",
              name: "MyCustomConfigName"
            }
          ]
        }`,
        '.app-config.schema.json5': `{
          type: "object",
          properties: {
            x: { type: "number" }
          },
        }`,
      },
      async (dir) => {
        const output = await generateTypeFiles({ directory: dir('.') });

        expect(output.length).toBe(1);

        const config = await readFile(dir('generated.d.ts')).then((v) => v.toString());

        expect(config).toMatchSnapshot();
      },
    );
  });

  it('creates a TypeScript file from schema with many $ref properties', async () => {
    await withTempFiles(
      {
        '.app-config.meta.json5': `{
          generate: [
            {
              file: "generated.d.ts"
            }
          ]
        }`,
        '.app-config.schema.json5': `{
          type: "object",
          properties: {
            root: { type: "boolean" },
            a: { $ref: "./a.yml" },
          },
        }`,
        'a.yml': `
          required: [b]
          type: object
          properties:
            b: { $ref: './-/-/b.yml' }
        `,
        '-/-/b.yml': `
          required: [c]
          type: object
          properties:
            c: { $ref: '../../c.yml' }
        `,
        'c.yml': `
          required: [d]
          type: object
          properties:
            d: { type: boolean }
        `,
      },
      async (dir) => {
        const output = await generateTypeFiles({ directory: dir('.') });

        expect(output.length).toBe(1);

        const config = await readFile(dir('generated.d.ts')).then((v) => v.toString());

        expect(config).toMatchSnapshot();
      },
    );
  });

  it('corrects Date type in TypeScript files', async () => {
    await withTempFiles(
      {
        '.app-config.meta.json5': `{
          generate: [
            {
              file: "generated.d.ts",
              name: "MyCustomConfigName"
            }
          ]
        }`,
        '.app-config.schema.json5': `{
          type: "object",
          properties: {
            x: { type: "string", format: "date" }
          },
        }`,
      },
      async (dir) => {
        const output = await generateTypeFiles({ directory: dir('.') });

        expect(output.length).toBe(1);

        const config = await readFile(dir('generated.d.ts')).then((v) => v.toString());

        expect(config).toMatch('x?: string');
        expect(config).toMatchSnapshot();
      },
    );
  });

  it('corrects date with multiple space', async () => {
    await withTempFiles(
      {
        '.app-config.meta.json5': `{
          generate: [{ file: "generated.d.ts" }]
        }`,
        '.app-config.schema.yaml': `
          type: object
          additionalProperties: false
          required:
            - commit
            - date

          properties:
            commit:
              type: string

            date:
              type: string
              format: date-time
        `,
      },
      async (dir) => {
        const output = await generateTypeFiles({ directory: dir('.') });

        expect(output.length).toBe(1);

        const config = await readFile(dir('generated.d.ts')).then((v) => v.toString());

        expect(config).toMatch('date: string');
        expect(config).toMatchSnapshot();
      },
    );
  });

  it('uses single quotes in enum values', async () => {
    await withTempFiles(
      {
        '.app-config.meta.json5': `{
          generate: [{ file: "generated.d.ts" }]
        }`,
        '.app-config.schema.yaml': `
          type: object
          additionalProperties: false

          properties:
            commit:
              type: string
              enum:
                - foo
                - foo-bar
        `,
      },
      async (dir) => {
        const output = await generateTypeFiles({ directory: dir('.') });

        expect(output.length).toBe(1);

        const config = await readFile(dir('generated.d.ts')).then((v) => v.toString());

        expect(config).toMatch(`Foo = 'foo'`);
        expect(config).toMatch(`FooBar = 'foo-bar'`);
      },
    );
  });

  it('creates an empty interface for config', async () => {
    await withTempFiles(
      {
        '.app-config.meta.yml': `
          generate:
            - file: generated.d.ts
        `,
        '.app-config.schema.yml': ``,
      },
      async (inDir) => {
        const output = await generateTypeFiles({ directory: inDir('.') });

        expect(output.length).toBe(1);

        const config = await readFile(inDir('generated.d.ts')).then((v) => v.toString());

        expect(config).toMatch('interface Config {}');
      },
    );
  });

  it('augements specific module name', async () => {
    await withTempFiles(
      {
        '.app-config.meta.yml': `
          generate:
            - file: generated.d.ts
              augmentModule: foo-bar
        `,
        '.app-config.schema.yml': ``,
      },
      async (inDir) => {
        await generateTypeFiles({ directory: inDir('.') });
        const config = await readFile(inDir('generated.d.ts')).then((v) => v.toString());

        expect(config).toMatch(`declare module 'foo-bar'`);
      },
    );
  });
});

describe('Flow File Generation', () => {
  it('creates a simple flow file', async () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        foo: { type: 'string' },
      },
    } as const;

    const generated = await generateQuicktype(schema, 'flow', 'Configuration');

    expect(generated).toMatchSnapshot();
  });
});

describe('Golang File Generation', () => {
  it('creates a simple Go file', async () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        foo: { type: 'string' },
      },
    } as const;

    const generated = await generateQuicktype(schema, 'go', 'Configuration');

    expect(generated).toMatchSnapshot();
  });

  it('creates a Go file without singleton', async () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        foo: { type: 'string' },
      },
    } as const;

    const generated = await generateQuicktype(schema, 'go', 'Configuration', undefined, undefined, {
      'no-singleton': 'true',
    });

    expect(generated).toMatchSnapshot();
  });
});

describe('Rust File Generation', () => {
  it('creates a simple Rust file', async () => {
    const schema = {
      type: 'object',
      additionalProperties: false,
      properties: {
        foo: { type: 'string' },
      },
    } as const;

    const generated = await generateQuicktype(schema, 'rust', 'Configuration');

    expect(generated).toMatchSnapshot();
  });
});
