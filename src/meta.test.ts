import { join } from 'path';
import { readFile } from 'fs-extra';
import { generateTypeFiles } from './meta';
import { withFakeFiles } from './test-util';

test('meta property in schema', async () => {
  await withFakeFiles([
    [
      '.app-config.schema.json',
      `
      {
        "app-config": {
          "generate": [
            {
              "type": "ts",
              "file": "config.ts"
            }
          ]
        },
        "required": ["x"],
        "properties": {
          "x": { "type": "number" }
        }
      }
      `,
    ],
  ], async (dir) => {
    const output = await generateTypeFiles(dir);
    expect(output.length).toBe(1);

    const config = (await readFile(join(dir, 'config.ts'))).toString('utf8');

    expect(config).toBeTruthy();
    expect(config).toMatch('x: number;');
  });
});

test('meta property in config', async () => {
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
      '.app-config.json',
      `
      {
        "app-config": {
          "generate": [
            {
              "type": "ts",
              "file": "config2.ts"
            }
          ]
        }
      }
      `,
    ],
  ], async (dir) => {
    const output = await generateTypeFiles(dir);
    expect(output.length).toBe(1);

    const config = (await readFile(join(dir, 'config2.ts'))).toString('utf8');

    expect(config).toBeTruthy();
    expect(config).toMatch('x: number;');
  });
});

test('meta config file', async () => {
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
      '.app-config.meta.json',
      `
      {
        "generate": [
          {
            "type": "ts",
            "file": "config3.ts"
          }
        ]
      }
      `,
    ],
  ], async (dir) => {
    const output = await generateTypeFiles(dir);
    expect(output.length).toBe(1);

    const config = (await readFile(join(dir, 'config3.ts'))).toString('utf8');

    expect(config).toBeTruthy();
    expect(config).toMatch('x: number;');
  });
});

test('meta info in package.json', async () => {
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
      'package.json',
      `
      {
        "app-config": {
          "generate": [
            {
              "type": "ts",
              "file": "config4.ts"
            }
          ]
        }
      }
      `,
    ],
  ], async (dir) => {
    const output = await generateTypeFiles(dir);
    expect(output.length).toBe(1);

    const config = (await readFile(join(dir, 'config4.ts'))).toString('utf8');

    expect(config).toBeTruthy();
    expect(config).toMatch('x: number;');
  });
});

test('named export codegen', async () => {
  await withFakeFiles([
    ['.app-config.schema.json5', `{
      "properties": {
        "x": { "type": "number" }
      },
    }`],
    [
      '.app-config.meta.json',
      `
      {
        "generate": [
          {
            "type": "ts",
            "file": "config3.ts",
            "name": "MyCustomConfigName",
          }
        ]
      }
      `,
    ],
  ], async (dir) => {
    const output = await generateTypeFiles(dir);
    expect(output.length).toBe(1);

    const config = (await readFile(join(dir, 'config3.ts'))).toString('utf8');

    expect(config).toBeTruthy();
    expect(config).toMatch('interface MyCustomConfigName');
  });
});

test('deep ref recursion in generation', async () => {
  await withFakeFiles([
    [
      'a/app-config.schema.yml',
      `
      required: [x]
      type: object
      properties:
        x: { $ref: '../root.yml' }
      `,
    ],
    [
      'root.yml',
      `
      required: [y]
      type: object
      properties:
        y: { $ref: 'b/-/-/1.yml' }
      `,
    ],
    [
      'b/-/-/1.yml',
      `
      required: [z]
      type: object
      properties:
        z: { $ref: '../../2.yml' }
      `,
    ],
    [
      'b/2.yml',
      `
      type: array
      items: { type: number }
      `,
    ],
    [
      'a/app-config.yml',
      `
      app-config:
        generate:
          - { file: "types.ts", name: CustomTypes }
      x:
        y:
          z: [0]
      `,
    ],
  ], async (dir) => {
    const output = await generateTypeFiles(`${dir}/a`);
    expect(output.length).toBe(1);

    const config = (await readFile(join(dir, 'a/types.ts'))).toString('utf8');
    expect(config).toMatch('export interface CustomTypes');
    expect(config).toMatch('x: X');
    expect(config).toMatch('y: Y');
    expect(config).toMatch('z: number[]');
  });
});
