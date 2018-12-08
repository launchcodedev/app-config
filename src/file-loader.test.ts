import { join } from 'path';
import { readFile, outputFile, remove } from 'fs-extra';
import {
  FileType,
  extToFileType,
  guessFileType,
  parseFile,
  parseFileSync,
} from './file-loader';

const testDir = './test-dir';

afterAll(async (done) => {
  await remove(testDir);
  done();
});

const withFakeFile = async (
  name: string,
  contents: string,
  cb: (name: string) => Promise<any>,
) => {
  await outputFile(join(testDir, name), contents);
  await cb(join(testDir, name));
  await remove(join(testDir, name));
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
  await withFakeFile('./nested/dir/fake-file.toml', `
    [top]
    foo = "bar"

    [top2]
    bar = "foo"
  `, async (filename) => {
    const [fileType, obj] = await parseFile(filename);

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual({
      top: { foo: 'bar' },
      top2: { bar: 'foo' },
    });
  });

  await withFakeFile('./nested/dir/fake-file', `
    [unlabeled]
    toml = "file"
  `, async (filename) => {
    const [fileType, obj] = await parseFile(filename);

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
  `, async (filename) => {
    const [fileType, obj] = await parseFile(filename);

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
  `, async (filename) => {
    const [fileType, obj] = await parseFile(filename);

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
  `, async (filename) => {
    const [fileType, obj] = await parseFile(filename);

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({
      top: { foo: 'bar' },
      top2: { bar: 'foo' },
    });
  });

  await withFakeFile('./nested/dir/fake-file', `
    unlabeled:
      yaml: 'file'
  `, async (filename) => {
    const [fileType, obj] = await parseFile(filename);

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({
      unlabeled: { yaml: 'file' },
    });
  });
});

test('parse file sync', async () => {
  await withFakeFile('./nested/dir/fake-file.yml', `
    foo: 'bar'
  `, async (filename) => {
    const [fileType, obj] = parseFileSync(filename);

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({
      foo: 'bar',
    });
  });
});

test('load file without extension', async () => {
  await withFakeFile('./nested/dir/fake-file.toml', `
    [top]
    foo = "bar"
  `, async (filename) => {
    const [fileType, obj] = await parseFile(filename.replace(/\.[^/.]+$/, ''));

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual({
      top: { foo: 'bar' },
    });
  });

  await withFakeFile('./nested/dir/fake-file.json', '{}', async (filename) => {
    const [fileType, obj] = await parseFile(filename.replace(/\.[^/.]+$/, ''));

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual({});
  });

  await withFakeFile('./nested/dir/fake-file.yml', '{}', async (filename) => {
    const [fileType, obj] = await parseFile(filename.replace(/\.[^/.]+$/, ''));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({});
  });
});

test('load file sync without extension', async () => {
  await withFakeFile('./nested/dir/fake-file.toml', `
    [top]
    foo = "bar"
  `, async (filename) => {
    const [fileType, obj] = parseFileSync(filename.replace(/\.[^/.]+$/, ''));

    expect(fileType).toBe(FileType.TOML);
    expect(obj).toEqual({
      top: { foo: 'bar' },
    });
  });

  await withFakeFile('./nested/dir/fake-file.json', '{}', async (filename) => {
    const [fileType, obj] = parseFileSync(filename.replace(/\.[^/.]+$/, ''));

    expect(fileType).toBe(FileType.JSON);
    expect(obj).toEqual({});
  });

  await withFakeFile('./nested/dir/fake-file.yml', '{}', async (filename) => {
    const [fileType, obj] = parseFileSync(filename.replace(/\.[^/.]+$/, ''));

    expect(fileType).toBe(FileType.YAML);
    expect(obj).toEqual({});
  });
});
