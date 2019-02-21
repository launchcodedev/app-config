import { join } from 'path';
import { readFile } from 'fs-extra';
import { withFakeFiles } from './test-util';
import { generateTypeFiles } from './generate';

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
