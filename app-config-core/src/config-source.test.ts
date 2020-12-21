import {
  ConfigSource,
  CombinedSource,
  FallbackSource,
  LiteralSource,
  FileType,
  stringify,
  parseRawString,
  guessFileType,
  filePathAssumedType,
} from './config-source';
import { ParsingExtension } from './parsed-value';
import { NotFoundError } from './errors';

class FailSource extends ConfigSource {
  async readContents(): Promise<[string, FileType]> {
    throw new NotFoundError();
  }
}

const flattenExtension: ParsingExtension = (value, [_, key]) => {
  if (key === '$flatten') {
    return (parse) => parse(value, { shouldFlatten: true });
  }

  return false;
};

const uppercaseExtension: ParsingExtension = (value) => {
  if (typeof value === 'string') {
    return (parse) => parse(value.toUpperCase());
  }

  return false;
};

describe('Parsing', () => {
  it('interprets an empty object', async () => {
    const source = new LiteralSource({});
    const parsed = await source.read();

    expect(parsed.sources[0]).toBe(source);
    expect(parsed.raw).toEqual({});
    expect(parsed.toJSON()).toEqual({});
    expect(parsed.toString()).toEqual('{}');
  });

  it('uses parsing extensions', async () => {
    const parsed = await new LiteralSource({
      $flatten: 'bar',
    }).read([flattenExtension]);

    expect(parsed.toJSON()).toEqual('bar');
  });

  it('uses parsing extensions in nested objects', async () => {
    const parsed = await new LiteralSource({
      foo: {
        $flatten: 'bar',
      },
    }).read([flattenExtension]);

    expect(parsed.toJSON()).toEqual({ foo: 'bar' });
  });

  it('uses value transform extension', async () => {
    const parsed = await new LiteralSource({
      foo: 'bar',
    }).read([uppercaseExtension]);

    expect(parsed.toJSON()).toEqual({ foo: 'BAR' });
  });

  it('uses multiple extensions', async () => {
    const parsed = await new LiteralSource({
      foo: {
        $flatten: 'bar',
      },
    }).read([flattenExtension, uppercaseExtension]);

    expect(parsed.toJSON()).toEqual({ foo: 'BAR' });
  });
});

describe('CombinedSource', () => {
  it('fails when no sources are provided', () => {
    expect(() => new CombinedSource([])).toThrow();
  });

  it('combines a few sources', async () => {
    const source = new CombinedSource([
      new LiteralSource({ foo: 1 }),
      new LiteralSource({ bar: 2 }),
      new LiteralSource({ baz: 3 }),
    ]);

    const parsed = await source.read();

    expect(parsed.sources[0]).toBe(source);
    expect(parsed.toJSON()).toEqual({ foo: 1, bar: 2, baz: 3 });
  });
});

describe('FallbackSource', () => {
  it('fails when no sources are provided', () => {
    expect(() => new FallbackSource([])).toThrow();
  });

  it('selects the first source', async () => {
    const source = new FallbackSource([
      new LiteralSource({ foo: 1 }),
      new LiteralSource({ bar: 2 }),
      new LiteralSource({ baz: 3 }),
    ]);

    const parsed = await source.read();

    expect(parsed.sources[0]).toBe(source.sources[0]);
    expect(parsed.toJSON()).toEqual({ foo: 1 });
  });

  it('selects source when first one fails', async () => {
    const source = new FallbackSource([
      new FailSource(),
      new LiteralSource({ bar: 2 }),
      new LiteralSource({ baz: 3 }),
    ]);

    const parsed = await source.read();

    expect(parsed.sources[0]).toBe(source.sources[1]);
    expect(parsed.toJSON()).toEqual({ bar: 2 });
  });
});

describe('stringify', () => {
  it('serializes TOML', () => {
    expect(stringify({ foo: 'bar' }, FileType.TOML)).toMatchSnapshot();
  });

  it('serializes YAML', () => {
    expect(stringify({ foo: 'bar' }, FileType.YAML)).toMatchSnapshot();
  });

  it('serializes JSON', () => {
    expect(stringify({ foo: 'bar' }, FileType.JSON)).toMatchSnapshot();
  });

  it('serializes JSON5', () => {
    expect(stringify({ foo: 'bar' }, FileType.JSON5)).toMatchSnapshot();
  });
});

describe('parseRawString', () => {
  it('parses TOML', async () => {
    await expect(parseRawString('foo = "bar"', FileType.TOML)).resolves.toEqual({ foo: 'bar' });
  });

  it('parses YAML', async () => {
    await expect(parseRawString('foo: bar', FileType.YAML)).resolves.toEqual({ foo: 'bar' });
  });

  it('parses JSON', async () => {
    await expect(parseRawString('{ "foo": "bar" }', FileType.JSON)).resolves.toEqual({
      foo: 'bar',
    });
  });

  it('parses JSON5', async () => {
    await expect(parseRawString('{ foo: "bar" }', FileType.JSON5)).resolves.toEqual({ foo: 'bar' });
  });
});

describe('guessFileType', () => {
  it('guesses TOML', async () => {
    await expect(guessFileType('foo = "bar"')).resolves.toBe(FileType.TOML);
  });

  it('guesses YAML', async () => {
    await expect(guessFileType('foo: bar')).resolves.toBe(FileType.YAML);
  });
});

describe('filePathAssumedType', () => {
  it('guesses various file types', () => {
    expect(filePathAssumedType('/foo/bar/baz.yml')).toBe(FileType.YAML);
    expect(filePathAssumedType('/foo/bar/baz.yaml')).toBe(FileType.YAML);
    expect(filePathAssumedType('/foo/bar/baz.json')).toBe(FileType.JSON);
    expect(filePathAssumedType('/foo/bar/baz.json5')).toBe(FileType.JSON5);
    expect(filePathAssumedType('/foo/bar/baz.toml')).toBe(FileType.TOML);
  });
});
