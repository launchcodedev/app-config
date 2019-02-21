import { join } from 'path';
import { readFile } from 'fs-extra';
import { generateTypeFiles } from './generate';
import { withFakeFiles } from './test-util';

test('named export codegen', async () => {
  await withFakeFiles([
    [
      '.app-config.yml',
      `
      `,
    ],
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
            "name": "MyCustomConfigName"
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

test('generate config file', async () => {
  await withFakeFiles([
    [
      '.app-config.yml',
      `
      `,
    ],
    [
      '.app-config.schema.json5',
      `{
        "properties": {
          "x": { "type": "number" }
        },
      }`,
    ],
    [
      '.app-config.meta.json',
      `
      {
        "generate": [
          {
            "file": "config.json"
          }
        ]
      }
      `,
    ],
  ], async (dir) => {
    const output = await generateTypeFiles(dir);
    expect(output.length).toBe(1);

    const config = (await readFile(join(dir, 'config.json'))).toString('utf8');

    expect(() => {
      const parsed = JSON.parse(config);

      expect(parsed).toEqual({});
    }).not.toThrow();
  });
});
