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
