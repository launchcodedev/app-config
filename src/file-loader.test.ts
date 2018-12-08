import { readFile, outputFile, remove } from 'fs-extra';
import {
  FileType,
  extToFileType,
  guessFileType,
  parseFile,
  parseFileSync,
} from './file-loader';

const withFakeFile = async (name: string, contents: string, cb: () => Promise<any>) => {
  await outputFile(name, contents);
  await cb();
  await remove(name);
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
  `)).toEqual([
    FileType.JSON,
    {
      foo: 'bar',
    },
  ]);

  expect(guessFileType(`
    [foo]
    bar = true
  `)).toEqual([
    FileType.TOML,
    {
      foo: {
        bar: true,
      },
    },
  ]);

  expect(guessFileType(`
    bar:
      - foo: true
  `)).toEqual([
    FileType.YAML,
    {
      bar: [
        { foo: true },
      ],
    },
  ]);

  expect(guessFileType('"string"')).toEqual([
    FileType.JSON,
    'string',
  ]);

  expect(guessFileType('23')).toEqual([
    FileType.JSON,
    23,
  ]);
});

test('load toml file', async () => {
  await withFakeFile('./nested/dir/fake-file.toml', `
    [top]
    foo = "bar"

    [top2]
    bar = "foo"
  `, async () => {
    const [fileType, obj] = await parseFile('./nested/dir/fake-file.toml');

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual({
      top: { foo: 'bar' },
      top2: { bar: 'foo' },
    });
  });

  await withFakeFile('./nested/dir/fake-file', `
    [unlabeled]
    toml = "file"
  `, async () => {
    const [fileType, obj] = await parseFile('./nested/dir/fake-file');

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual({
      unlabeled: { toml: 'file' },
    });
  });
});

test('load json file', async () => {
  await withFakeFile('./nested/dir/fake-file.json', `
    {
      "top": { "foo": "bar" },
      "top2": { "bar": "foo" },
    }
  `, async () => {
    const [fileType, obj] = await parseFile('./nested/dir/fake-file.json');

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual({
      top: { foo: 'bar' },
      top2: { bar: 'foo' },
    });
  });

  await withFakeFile('./nested/dir/fake-file', `
    {
      "unlabeled": {
        "json": "file"
      }
    }
  `, async () => {
    const [fileType, obj] = await parseFile('./nested/dir/fake-file');

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual({
      unlabeled: { json: 'file' },
    });
  });
});

test('load yaml file', async () => {
  await withFakeFile('./nested/dir/fake-file.yml', `
    top:
      foo: 'bar'
    top2:
      bar: 'foo'
  `, async () => {
    const [fileType, obj] = await parseFile('./nested/dir/fake-file.yml');

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({
      top: { foo: 'bar' },
      top2: { bar: 'foo' },
    });
  });

  await withFakeFile('./nested/dir/fake-file', `
    unlabeled:
      yaml: 'file'
  `, async () => {
    const [fileType, obj] = await parseFile('./nested/dir/fake-file');

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({
      unlabeled: { yaml: 'file' },
    });
  });
});

test('parse file sync', async () => {
  await withFakeFile('./nested/dir/fake-file.yml', `
    foo: 'bar'
  `, async () => {
    const [fileType, obj] = parseFileSync('./nested/dir/fake-file.yml');

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({
      foo: 'bar',
    });
  });
});
