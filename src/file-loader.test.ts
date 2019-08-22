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
import { loadConfig, loadConfigSync, ConfigSource } from './config';

describe('ext to file type', () => {
  expect(extToFileType('toml')).toBe(FileType.TOML);
  expect(extToFileType('yaml')).toBe(FileType.YAML);
  expect(extToFileType('yml')).toBe(FileType.YAML);
  expect(extToFileType('json')).toBe(FileType.JSON);
  expect(extToFileType('json5')).toBe(FileType.JSON5);
  expect(extToFileType('', '23')).toBe(FileType.JSON);
  expect(extToFileType('', '[foo]')).toBe(FileType.TOML);
  expect(extToFileType('', 'foo:')).toBe(FileType.YAML);
});

describe('guess file type', () => {
  expect(guessFileType(`
    {
      "foo": "bar"
    }
  `)).toEqual(FileType.JSON);

  expect(guessFileType(`
    {
      "foo": "bar",
    }
  `)).toEqual(FileType.JSON5);

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
    const [fileType, file, obj] = await parseFile(join(dir, 'nested/dir/fake-file.toml'));

    expect(fileType).toBe(FileType.TOML);
    expect(file).toBe(join(dir, 'nested/dir/fake-file.toml'));
    expect(obj).toEqual(expected);
  }));

  test('file w/ extension sync', () => withFakeFiles([
    ['nested/dir/fake-file.toml', content],
  ], async (dir) => {
    const [fileType, _, obj] = parseFileSync(join(dir, 'nested/dir/fake-file.toml'));

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('file w/o extension', () => withFakeFiles([
    ['nested/dir/fake-file', content],
  ], async (dir) => {
    const [fileType, file, obj] = await parseFile(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.TOML);
    expect(file).toBe(join(dir, 'nested/dir/fake-file'));
    expect(obj).toEqual(expected);
  }));

  test('file w/o extension sync', () => withFakeFiles([
    ['nested/dir/fake-file', content],
  ], async (dir) => {
    const [fileType, file, obj] = parseFileSync(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.TOML);
    expect(file).toBe(join(dir, 'nested/dir/fake-file'));
    expect(obj).toEqual(expected);
  }));
});

describe('load json file', () => {
  const content = `
    {
      "top": {
        "foo": "bar"
      },
      "top2": {
        "bar": {
          "baz": "value"
        }
      }
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
    const [fileType, _, obj] = await parseFile(join(dir, 'nested/dir/fake-file.json'));

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual(expected);
  }));

  test('file w/ extension sync', () => withFakeFiles([
    ['nested/dir/fake-file.json', content],
  ], async (dir) => {
    const [fileType, _, obj] = parseFileSync(join(dir, 'nested/dir/fake-file.json'));

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual(expected);
  }));

  test('file w/o extension', () => withFakeFiles([
    ['nested/dir/fake-file', content],
  ], async (dir) => {
    const [fileType, _, obj] = await parseFile(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual(expected);
  }));

  test('file w/o extension sync', () => withFakeFiles([
    ['nested/dir/fake-file', content],
  ], async (dir) => {
    const [fileType, _, obj] = parseFileSync(join(dir, 'nested/dir/fake-file'));

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
    const [fileType, _, obj] = await parseFile(join(dir, 'nested/dir/fake-file.yml'));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));

  test('file w/ extension sync', () => withFakeFiles([
    ['nested/dir/fake-file.yml', content],
  ], async (dir) => {
    const [fileType, _, obj] = parseFileSync(join(dir, 'nested/dir/fake-file.yml'));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));

  test('file w/o extension', () => withFakeFiles([
    ['nested/dir/fake-file', content],
  ], async (dir) => {
    const [fileType, _, obj] = await parseFile(join(dir, 'nested/dir/fake-file'));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));

  test('file w/o extension sync', () => withFakeFiles([
    ['nested/dir/fake-file', content],
  ], async (dir) => {
    const [fileType, _, obj] = parseFileSync(join(dir, 'nested/dir/fake-file'));

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

    const [fileType, _, obj] = found!;

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

    const [fileType, _, obj] = found!;

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

    const [fileType, _, obj] = found!;

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

    const [fileType, _, obj] = found!;

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

    const [fileType, file, obj] = found!;

    expect(fileType).toBe(FileType.JSON);
    expect(file).toBe(join(dir, 'nested/dir/filename2.json'));
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

    const [fileType, file, obj] = found!;

    expect(fileType).toBe(FileType.JSON);
    expect(file).toBe(join(dir, 'nested/dir/filename2.json'));
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

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.JSON5);
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

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.JSON5);
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

describe('embedded env var', () => {
  beforeEach(() => {
    process.env.FOO = 'bar';
  });

  afterEach(() => {
    delete process.env.FOO;
  });

  const content = `
    foo = "$\{FOO\}"

    [[nested.deep]]
    foo = "$\{FOO\}"
    baz = "$FOO"
  `;

  const expected = {
    foo: 'bar',
    nested: {
      deep: [
        {
          foo: 'bar',
          baz: 'bar',
        },
      ],
    },
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));
});

describe('embedded env var with fallback', () => {
  const content = `
    foo = "$\{FOO:-bar\}"

    [[nested.deep]]
    foo = "$\{FOO:-bar\}"
  `;

  const expected = {
    foo: 'bar',
    nested: {
      deep: [
        {
          foo: 'bar',
        },
      ],
    },
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));
});

describe('embedded env var with empty fallback', () => {
  const content = `
    foo = "$\{FOO:-\}"

    [[nested.deep]]
    foo = "$\{FOO:-\}"
  `;

  const expected = {
    foo: '',
    nested: {
      deep: [
        {
          foo: '',
        },
      ],
    },
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));
});

describe('embedded env var with env fallback', () => {
  beforeEach(() => {
    process.env.BAR = 'bar';
  });

  afterEach(() => {
    delete process.env.BAR;
  });

  const content = `
    foo = "$\{FOO:-$\{BAR\}\}"

    [[nested.deep]]
    foo = "$\{FOO:-$\{BAR\}\}"
    baz = "$\{FOO:-bar\} $\{FOO:-$\{BAR\}\}"
  `;

  const expected = {
    foo: 'bar',
    nested: {
      deep: [
        {
          foo: 'bar',
          baz: 'bar bar',
        },
      ],
    },
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));
});

describe('empty embedded env var', () => {
  beforeEach(() => {
    process.env.FOO = '';
  });

  afterEach(() => {
    delete process.env.FOO;
  });

  const content = `
    foo = "$\{FOO\}"
  `;

  const expected = {
    foo: '',
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));
});

describe('embedded env var in array', () => {
  beforeEach(() => {
    process.env.FOO = 'bar';
  });

  afterEach(() => {
    delete process.env.FOO;
  });

  const content = `
    foo = ["$\{FOO\}"]
  `;

  const expected = {
    foo: ['bar'],
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));
});

describe('embedded env var mid string', () => {
  beforeEach(() => {
    process.env.FOOBAR = 'bar';
  });

  afterEach(() => {
    delete process.env.FOOBAR;
  });

  const content = `
    foo = " surrounding $\{FOOBAR\} context"
    bar = "B$\{INV:-fallback\}"
    baz = "$\{INV:-$\{FOOBAR\}\} plus"
    bat = "_$\{INV:-$\{INV2:-$\{FOOBAR\}\}\}_"
  `;

  const expected = {
    foo: ' surrounding bar context',
    bar: 'Bfallback',
    baz: 'bar plus',
    bat: '_bar_',
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));
});

describe('APP_CONFIG_ENV', () => {
  beforeEach(() => {
    process.env.ENV = 'production';
  });

  afterEach(() => {
    delete process.env.ENV;
  });

  const content = `
    foo = "$\{APP_CONFIG_ENV\}"
  `;

  const expected = {
    foo: 'production',
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));
});

describe('APP_CONFIG_ENV shorthand', () => {
  beforeEach(() => {
    process.env.ENV = 'dev';
  });

  afterEach(() => {
    delete process.env.ENV;
  });

  const content = `
    foo = "$\{APP_CONFIG_ENV\}"
  `;

  const expected = {
    foo: 'development',
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename.toml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename.toml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual(expected);
  }));
});

describe('resolving $env value', () => {
  beforeEach(() => {
    process.env.APP_CONFIG_ENV = 'production';
  });

  afterEach(() => {
    delete process.env.APP_CONFIG_ENV;
  });

  const content = `
    foo:
      bar:
        $env:
          production:
            baz: 14
          development:
            baz: 18
  `;

  const expected = {
    foo: {
      bar: {
        baz: 14,
      },
    },
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename.yml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename.yml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename.yml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename.yml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));
});

describe('resolving $env default value', () => {
  beforeEach(() => {
    delete process.env.NODE_ENV;
  });

  afterEach(() => {
    process.env.NODE_ENV = 'test';
  });

  const content = `
    foo:
      bar:
        $env:
          production:
            baz: 14
          development:
            baz: 18
          default:
            baz: 22
  `;

  const expected = {
    foo: {
      bar: {
        baz: 22,
      },
    },
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename.yml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename.yml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename.yml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename.yml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));
});

describe('$env supports environment aliases', () => {
  beforeEach(() => {
    process.env.APP_CONFIG_ENV = 'development';
  });

  afterEach(() => {
    delete process.env.APP_CONFIG_ENV;
  });

  const content = `
    foo:
      bar:
        $env:
          dev:
            baz: 18
          default:
            baz: 22
  `;

  const expected = {
    foo: {
      bar: {
        baz: 18,
      },
    },
  };

  test('async', () => withFakeFiles([
    ['nested/dir/filename.yml', content],
  ], async (dir) => {
    const found = await findParseableFile([
      join(dir, 'nested/dir/filename.yml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));

  test('sync', () => withFakeFiles([
    ['nested/dir/filename.yml', content],
  ], async (dir) => {
    const found = findParseableFileSync([
      join(dir, 'nested/dir/filename.yml'),
    ]);

    const [fileType, _, obj] = found!;

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual(expected);
  }));
});

describe('extends with an $env value', () => {
  const files: [string, string][] = [
    [
      '.app-config.yml',
      `
      app-config:
        extends:
          $env:
            development:
              - '.app-config.dev-extender.yml'
            default:
              - '.app-config.default-extender.yml'
      `,
    ],
    [
      '.app-config.dev-extender.yml',
      `
      value: 'dev'
      `,
    ],
    [
      '.app-config.default-extender.yml',
      `
      value: 'default'
      `,
    ],
  ];

  const defaultExpected = {
    value: 'default',
  };

  const devExpected = {
    value: 'dev',
  };

  afterEach(() => {
    delete process.env.APP_CONFIG_ENV;
  });

  test('async development', () => withFakeFiles(files, async (dir) => {
    process.env.APP_CONFIG_ENV = 'development';
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(devExpected);
  }));

  test('async default', () => withFakeFiles(files, async (dir) => {
    process.env.APP_CONFIG_ENV = 'triggers-default';
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(defaultExpected);
  }));

  test('sync development', () => withFakeFiles(files, async (dir) => {
    process.env.APP_CONFIG_ENV = 'development';
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(devExpected);
  }));

  test('sync default', () => withFakeFiles(files, async (dir) => {
    process.env.APP_CONFIG_ENV = 'triggers-default';
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(defaultExpected);
  }));
});

describe('app-config with $env value containing extends', () => {
  const files: [string, string][] = [
    [
      '.app-config.yml',
      `
        app-config:
          $env:
            development:
              extends:
                - '.app-config.dev-extender.yml'
            default:
              extends:
                - '.app-config.default-extender.yml'
      `,
    ],
    [
      '.app-config.dev-extender.yml',
      `
      value: 'dev'
      `,
    ],
    [
      '.app-config.default-extender.yml',
      `
      value: 'default'
      `,
    ],
  ];

  const defaultExpected = {
    value: 'default',
  };

  const devExpected = {
    value: 'dev',
  };

  afterEach(() => {
    delete process.env.APP_CONFIG_ENV;
  });

  test('async development', () => withFakeFiles(files, async (dir) => {
    process.env.APP_CONFIG_ENV = 'development';
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(devExpected);
  }));

  test('async default', () => withFakeFiles(files, async (dir) => {
    process.env.APP_CONFIG_ENV = 'triggers-default';
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(defaultExpected);
  }));

  test('sync development', () => withFakeFiles(files, async (dir) => {
    process.env.APP_CONFIG_ENV = 'development';
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(devExpected);
  }));

  test('sync default', () => withFakeFiles(files, async (dir) => {
    process.env.APP_CONFIG_ENV = 'triggers-default';
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(defaultExpected);
  }));
});

describe('$env containing app-config with extends', () => {
  const files: [string, string][] = [
    [
      '.app-config.yml',
      `
        $env:
          development:
            app-config:
              extends:
                - '.app-config.dev-extender.yml'
          default:
            app-config:
              extends:
                - '.app-config.default-extender.yml'
      `,
    ],
    [
      '.app-config.dev-extender.yml',
      `
      value: 'dev'
      `,
    ],
    [
      '.app-config.default-extender.yml',
      `
      value: 'default'
      `,
    ],
  ];

  const defaultExpected = {
    value: 'default',
  };

  const devExpected = {
    value: 'dev',
  };

  afterEach(() => {
    delete process.env.APP_CONFIG_ENV;
  });

  test('async development', () => withFakeFiles(files, async (dir) => {
    process.env.APP_CONFIG_ENV = 'development';
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(devExpected);
  }));

  test('async default', () => withFakeFiles(files, async (dir) => {
    process.env.APP_CONFIG_ENV = 'triggers-default';
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(defaultExpected);
  }));

  test('sync development', () => withFakeFiles(files, async (dir) => {
    process.env.APP_CONFIG_ENV = 'development';
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(devExpected);
  }));

  test('sync default', () => withFakeFiles(files, async (dir) => {
    process.env.APP_CONFIG_ENV = 'triggers-default';
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(defaultExpected);
  }));
});

describe('extends $env with root level $env merge objects properly', () => {
  const files: [string, string][] = [
    [
      '.app-config.yml',
      `
      app-config:
        extends:
          $env:
            default:
              - 'foo.yml'

      $env:
        default:
          base:
            bat: 'bob'
      `,
    ],
    [
      'foo.yml',
      `
      base:
        foo: 'bar'
      `,
    ],
  ];

  const expected = {
    base: {
      foo: 'bar',
      bat: 'bob',
    },
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});

describe('$env deep-merge arrays don\'t merge; last occurance overwrites', () => {
  const files: [string, string][] = [
    [
      '.app-config.yml',
      `
      foo:
        bar:
          - 'bat'
          - 'billy'
      $env:
        default:
          foo:
            bar:
              - 'bob'
            bob: 'yay'
      `,
    ],
  ];

  const expected = {
    foo: {
      bar: ['bob'],
      bob: 'yay',
    },
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});

describe('$env merges work regardless of occurance in file', () => {
  const files: [string, string][] = [
    [
      '.app-config.yml',
      `
      foo:
        bar:
          bat: 4
        $env:
          default:
            fizz:
              bob: 6
            bar:
              bob: 'yay'
        fizz:
          buzz: 2
      `,
    ],
  ];

  const expected = {
    foo: {
      bar: {
        bat: 4,
        bob: 'yay',
      },
      fizz: {
        buzz: 2,
        bob: 6,
      },
    },
  };

  test('async', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = await loadConfig(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));

  test('sync', () => withFakeFiles(files, async (dir) => {
    const { config, secrets, fileType, source } = loadConfigSync(dir);

    expect(source).toBe(ConfigSource.File);
    expect(fileType).toBe(FileType.YAML);
    expect(secrets).toEqual({});
    expect(config).toEqual(expected);
  }));
});
