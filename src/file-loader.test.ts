import { join } from 'path';
import {
  FileType,
  extToFileType,
  guessFileType,
  parseFile,
  parseFileSync,
  findParseableFile,
  findParseableFileSync,
} from './file-loader';
import { withFakeFiles } from './test-util';

describe('ext to file type', () => {
  expect(extToFileType('toml')).toBe(FileType.TOML);
  expect(extToFileType('yaml')).toBe(FileType.YAML);
  expect(extToFileType('yml')).toBe(FileType.YAML);
  expect(extToFileType('json')).toBe(FileType.JSON);
  expect(extToFileType('json5')).toBe(FileType.JSON);
  expect(extToFileType('', '23')).toBe(FileType.JSON);
  expect(extToFileType('', '[foo]')).toBe(FileType.TOML);
  expect(extToFileType('', 'foo:')).toBe(FileType.YAML);
});

describe('guess file type', () => {
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

describe('load toml file', () => {
  const content = `
    [top]
    foo = "bar"

    [top2]
    bar = { baz = "value" }
  `;

  const expected = {
    top: {
      foo: 'bar',
    },
    top2: {
      bar: {
        baz: 'value',
      },
    },
  };

  test('file w/ extension', () => withFakeFiles([
    ['nested/dir/fake-file.toml', content],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file.toml'));

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('file w/ extension sync', () => withFakeFiles([
    ['nested/dir/fake-file.toml', content],
  ], async (dir) => {
    const [fileType, obj] = parseFileSync(join(dir, 'nested/dir/fake-file.toml'));

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('file w/o extension', () => withFakeFiles([
    ['nested/dir/fake-file', content],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('file w/o extension sync', () => withFakeFiles([
    ['nested/dir/fake-file', content],
  ], async (dir) => {
    const [fileType, obj] = parseFileSync(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));
});

describe('load json file', () => {
  const content = `
    {
      "top": {
        "foo": "bar",
      },
      "top2": {
        "bar": {
          "baz": "value",
        },
      },
    }
  `;

  const expected = {
    top: {
      foo: 'bar',
    },
    top2: {
      bar: {
        baz: 'value',
      },
    },
  };

  test('file w/ extension', () => withFakeFiles([
    ['nested/dir/fake-file.json', content],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file.json'));

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual(expected);
  }));

  test('file w/ extension sync', () => withFakeFiles([
    ['nested/dir/fake-file.json', content],
  ], async (dir) => {
    const [fileType, obj] = parseFileSync(join(dir, 'nested/dir/fake-file.json'));

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual(expected);
  }));

  test('file w/o extension', () => withFakeFiles([
    ['nested/dir/fake-file', content],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual(expected);
  }));

  test('file w/o extension sync', () => withFakeFiles([
    ['nested/dir/fake-file', content],
  ], async (dir) => {
    const [fileType, obj] = parseFileSync(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual(expected);
  }));
});

describe('load yaml file', () => {
  const content = `
    top:
      foo: bar
    top2:
      bar:
        baz: value
  `;

  const expected = {
    top: {
      foo: 'bar',
    },
    top2: {
      bar: {
        baz: 'value',
      },
    },
  };

  test('file w/ extension', () => withFakeFiles([
    ['nested/dir/fake-file.yml', content],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file.yml'));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));

  test('file w/ extension sync', () => withFakeFiles([
    ['nested/dir/fake-file.yml', content],
  ], async (dir) => {
    const [fileType, obj] = parseFileSync(join(dir, 'nested/dir/fake-file.yml'));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));

  test('file w/o extension', () => withFakeFiles([
    ['nested/dir/fake-file', content],
  ], async (dir) => {
    const [fileType, obj] = await parseFile(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));

  test('file w/o extension sync', () => withFakeFiles([
    ['nested/dir/fake-file', content],
  ], async (dir) => {
    const [fileType, obj] = parseFileSync(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));
});

describe('find toml file', () => {
  const content = `
    foo = "bar"
  `;

  const expected = {
    foo: 'bar',
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename2.toml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename0.toml'),
      join(dir, 'nested/dir/filename1.toml'),
      join(dir, 'nested/dir/filename2.toml'),
      join(dir, 'nested/dir/filename3.toml'),
    ]);

    const [fileType, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename2.toml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename0.toml'),
      join(dir, 'nested/dir/filename1.toml'),
      join(dir, 'nested/dir/filename2.toml'),
      join(dir, 'nested/dir/filename3.toml'),
    ]);

    const [fileType, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));
});

describe('find yaml file', () => {
  const content = `
    foo: bar
  `;

  const expected = {
    foo: 'bar',
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename2.yml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename0.yml'),
      join(dir, 'nested/dir/filename1.yml'),
      join(dir, 'nested/dir/filename2.yml'),
      join(dir, 'nested/dir/filename3.yml'),
    ]);

    const [fileType, obj] = found!;

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename2.yml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename0.yml'),
      join(dir, 'nested/dir/filename1.yml'),
      join(dir, 'nested/dir/filename2.yml'),
      join(dir, 'nested/dir/filename3.yml'),
    ]);

    const [fileType, obj] = found!;

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));
});

describe('find json file', () => {
  const content = `
    {
      "foo": "bar"
    }
  `;

  const expected = {
    foo: 'bar',
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename2.json', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename0.json'),
      join(dir, 'nested/dir/filename1.json'),
      join(dir, 'nested/dir/filename2.json'),
      join(dir, 'nested/dir/filename3.json'),
    ]);

    const [fileType, obj] = found!;

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename2.json', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename0.json'),
      join(dir, 'nested/dir/filename1.json'),
      join(dir, 'nested/dir/filename2.json'),
      join(dir, 'nested/dir/filename3.json'),
    ]);

    const [fileType, obj] = found!;

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual(expected);
  }));
});

describe('find json5 file', () => {
  const content = `
    {
      "foo": "bar",
    }
  `;

  const expected = {
    foo: 'bar',
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename2.json5', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename0.json5'),
      join(dir, 'nested/dir/filename1.json5'),
      join(dir, 'nested/dir/filename2.json5'),
      join(dir, 'nested/dir/filename3.json5'),
    ]);

    const [fileType, obj] = found!;

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename2.json5', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename0.json5'),
      join(dir, 'nested/dir/filename1.json5'),
      join(dir, 'nested/dir/filename2.json5'),
      join(dir, 'nested/dir/filename3.json5'),
    ]);

    const [fileType, obj] = found!;

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual(expected);
  }));
});

describe('find no files', () => {
  test('async', () => withFakeFiles([], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/fake-file1.yml'),
      join(dir, 'nested/dir/fake-file2.yml'),
      join(dir, 'nested/dir/fake-file3.yml'),
      join(dir, 'nested/dir/fake-file4.yml'),
    ]);

    expect(found).toBe(undefined);
  }));

  test('sync', () => withFakeFiles([], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/fake-file1.yml'),
      join(dir, 'nested/dir/fake-file2.yml'),
      join(dir, 'nested/dir/fake-file3.yml'),
      join(dir, 'nested/dir/fake-file4.yml'),
    ]);

    expect(found).toBe(undefined);
  }));
});

describe('invalid file parsing', () => {
  test('toml', () => withFakeFiles([
    [
      'nested/dir/fake-file3.toml',
      `
      invalid key = "val"
      `,
    ],
  ], async (dir) => {
    await expect(findParseableFile([
      join(dir, 'nested/dir/fake-file1.toml'),
      join(dir, 'nested/dir/fake-file2.toml'),
      join(dir, 'nested/dir/fake-file3.toml'),
      join(dir, 'nested/dir/fake-file4.toml'),
    ])).rejects.toThrow();
  }));
});
