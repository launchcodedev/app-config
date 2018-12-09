import { dir } from 'tmp-promise';
import { join } from 'path';
import { outputFile, remove } from 'fs-extra';
import {
  FileType,
  extToFileType,
  guessFileType,
  parseFile,
  parseFileSync,
  findParseableFile,
  findParseableFileSync,
} from './file-loader';

const withFakeFiles = async (
  files: [string, string][],
  cb: (dir: string) => Promise<any>,
) => {
  const { path: tmp } = await dir();
  const filenames = files.map(([name]) => join(tmp, name));
  await Promise.all(filenames.map(async (name, i) => {
    await outputFile(name, files[i][1]);
  }));

  await cb(tmp);
  await remove(tmp);
};

test('ext to file type', async () => {
  expect(extToFileType('toml')).toBe(FileType.TOML);
  expect(extToFileType('yaml')).toBe(FileType.YAML);
  expect(extToFileType('yml')).toBe(FileType.YAML);
  expect(extToFileType('json')).toBe(FileType.JSON);
  expect(extToFileType('json5')).toBe(FileType.JSON);
  expect(extToFileType('', '23')).toBe(FileType.JSON);
  expect(extToFileType('', '[foo]')).toBe(FileType.TOML);
  expect(extToFileType('', 'foo:')).toBe(FileType.YAML);
});

test('guess file type', async () => {
  expect(guessFileType(`
    {
      "foo": "bar",
    }
  `)).toEqual(FileType.JSON);

  expect(guessFileType(`
    [foo]
    bar = true
  `)).toEqual(FileType.TOML);

  expect(guessFileType(`
    bar:
      - foo: true
  `)).toEqual(FileType.YAML);

  expect(guessFileType('"string"')).toEqual(FileType.JSON);

  expect(guessFileType('23')).toEqual(FileType.JSON);
});

test('load toml file', async () => {
  await withFakeFiles([
    [
      'nested/dir/fake-file.toml',
      `
      [top]
      foo = "bar"

      [top2]
      bar = "foo"
      `,
    ],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file.toml'));

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual({
      top: { foo: 'bar' },
      top2: { bar: 'foo' },
    });
  });

  await withFakeFiles([
    [
      'nested/dir/fake-file',
      `
      [unlabeled]
      toml = "file"
      `,
    ],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual({
      unlabeled: { toml: 'file' },
    });
  });
});

test('load json file', async () => {
  await withFakeFiles([
    [
      'nested/dir/fake-file.json',
      `
      {
        "top": { "foo": "bar" },
        "top2": { "bar": "foo" },
      }
      `,
    ],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file.json'));

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual({
      top: { foo: 'bar' },
      top2: { bar: 'foo' },
    });
  });

  await withFakeFiles([
    [
      'nested/dir/fake-file',
      `
      {
        "unlabeled": {
          "json": "file"
        }
      }
      `,
    ],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual({
      unlabeled: { json: 'file' },
    });
  });
});

test('load yaml file', async () => {
  await withFakeFiles([
    [
      'nested/dir/fake-file.yml',
      `
      top:
        foo: 'bar'
      top2:
        bar: 'foo'
      `,
    ],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file.yml'));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({
      top: { foo: 'bar' },
      top2: { bar: 'foo' },
    });
  });

  await withFakeFiles([
    [
      'nested/dir/fake-file',
      `
      unlabeled:
        yaml: 'file'
      `,
    ],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({
      unlabeled: { yaml: 'file' },
    });
  });
});

test('parse file sync', async () => {
  await withFakeFiles([
    [
      'nested/dir/fake-file.yml',
      `
      foo: 'bar'
      `,
    ],
  ], async (dir) => {
    const [fileType, obj] = parseFileSync(join(dir, 'nested/dir/fake-file.yml'));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({
      foo: 'bar',
    });
  });
});

test('load file without extension', async () => {
  await withFakeFiles([
    [
      'nested/dir/fake-file.toml',
      `
      [top]
      foo = "bar"
      `,
    ],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual({
      top: { foo: 'bar' },
    });
  });

  await withFakeFiles([
    [
      'nested/dir/fake-file.json', '{}',
    ],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual({});
  });

  await withFakeFiles([
    [
      'nested/dir/fake-file.yml', '{}',
    ],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({});
  });
});

test('load file sync without extension', async () => {
  await withFakeFiles([
    [
      'nested/dir/fake-file.toml',
      `
      [top]
      foo = "bar"
      `,
    ],
  ], async (dir) => {
    const [fileType, obj] = parseFileSync(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual({
      top: { foo: 'bar' },
    });
  });

  await withFakeFiles([
    [
      'nested/dir/fake-file.json', '{}',
    ],
  ], async (dir) => {
    const [fileType, obj] = parseFileSync(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual({});
  });

  await withFakeFiles([
    [
      'nested/dir/fake-file.yml', '{}',
    ],
  ], async (dir) => {
    const [fileType, obj] = parseFileSync(join(dir, 'nested/dir/fake-file.yml'));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({});
  });
});

test('find parseable file', async () => {
  await withFakeFiles([
    [
      'nested/dir/fake-file3.yml',
      `
      foo: 'bar'
      `,
    ],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/fake-file1.yml'),
      join(dir, 'nested/dir/fake-file2.yml'),
      join(dir, 'nested/dir/fake-file3.yml'),
      join(dir, 'nested/dir/fake-file4.yml'),
    ]);

    const [fileType, obj] = found!;

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({
      foo: 'bar',
    });
  });
});

test('find parseable file sync', async () => {
  await withFakeFiles([
    [
      'nested/dir/fake-file3.yml',
      `
      foo: 'bar'
      `,
    ],
  ], async (dir) => {
    const [fileType, obj] = findParseableFileSync([
      join(dir, 'nested/dir/fake-file1.yml'),
      join(dir, 'nested/dir/fake-file2.yml'),
      join(dir, 'nested/dir/fake-file3.yml'),
      join(dir, 'nested/dir/fake-file4.yml'),
    ])!;

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({
      foo: 'bar',
    });
  });
});

test('find missing file sync', async () => {
  await withFakeFiles([], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/fake-file1.yml'),
      join(dir, 'nested/dir/fake-file2.yml'),
      join(dir, 'nested/dir/fake-file3.yml'),
      join(dir, 'nested/dir/fake-file4.yml'),
    ]);

    expect(found).toBe(undefined);
  });
});

test('find missing file', async () => {
  await withFakeFiles([], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/fake-file1.yml'),
      join(dir, 'nested/dir/fake-file2.yml'),
      join(dir, 'nested/dir/fake-file3.yml'),
      join(dir, 'nested/dir/fake-file4.yml'),
    ]);

    expect(found).toBe(undefined);
  });
});

test('find file with parsing error sync', async () => {
  await withFakeFiles([
    [
      'nested/dir/fake-file3.toml',
      `
      invalid key = "val"
      `,
    ],
  ], async (dir) => {
    expect(() => {
      findParseableFileSync([
        join(dir, 'nested/dir/fake-file1.toml'),
        join(dir, 'nested/dir/fake-file2.toml'),
        join(dir, 'nested/dir/fake-file3.toml'),
        join(dir, 'nested/dir/fake-file4.toml'),
      ]);
    }).toThrow();
  });
});

test('find file with parsing error', async () => {
  await withFakeFiles([
    [
      'nested/dir/fake-file3.toml',
      `
      invalid key = "val"
      `,
    ],
  ], async (dir) => {
    const promise = findParseableFile([
      join(dir, 'nested/dir/fake-file1.toml'),
      join(dir, 'nested/dir/fake-file2.toml'),
      join(dir, 'nested/dir/fake-file3.toml'),
      join(dir, 'nested/dir/fake-file4.toml'),
    ]);

    await expect(promise).rejects.toThrow();
  });
});
