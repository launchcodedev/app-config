import { withTempFiles } from '@app-config/test-utils';
import {
  ConfigSource,
  LiteralSource,
  CombinedSource,
  FallbackSource,
  FileType,
  stringify,
} from './config-source';
import { ParsingExtension } from './parsed-value';
import { NotFoundError } from './errors';

class FailingSource extends ConfigSource {
  readContents(): Promise<[string, FileType]> {
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

  it('uses readToJSON shorthand', async () => {
    const parsed = await new LiteralSource({
      foo: {
        $flatten: 'bar',
      },
    }).readToJSON([flattenExtension]);

    expect(parsed).toEqual({ foo: 'bar' });
  });

  it('loads using readContents correctly', async () => {
    const [text, fileType] = await new LiteralSource({ foo: 'bar' }).readContents();

    expect([text, fileType]).toMatchSnapshot();
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

  it('loads using readContents correctly', async () => {
    const [text, fileType] = await new CombinedSource([
      new LiteralSource({ foo: 1 }),
      new LiteralSource({ bar: 2 }),
      new LiteralSource({ baz: 3 }),
    ]).readContents();

    expect([text, fileType]).toMatchSnapshot();
  });

  it('loads using readValue correctly', async () => {
    const value = await new CombinedSource([
      new LiteralSource({ foo: 1 }),
      new LiteralSource({ bar: 2 }),
      new LiteralSource({ baz: 3 }),
    ]).readValue();

    expect(value).toEqual({ foo: 1, bar: 2, baz: 3 });
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
      new FailingSource(),
      new LiteralSource({ bar: 2 }),
      new LiteralSource({ baz: 3 }),
    ]);

    const parsed = await source.read();

    expect(parsed.sources[0]).toBe(source.sources[1]);
    expect(parsed.toJSON()).toEqual({ bar: 2 });
  });

  it('loads using readContents correctly', async () => {
    const [text, fileType] = await new FallbackSource([
      new LiteralSource({ foo: 1 }),
      new LiteralSource({ bar: 2 }),
      new LiteralSource({ baz: 3 }),
    ]).readContents();

    expect([text, fileType]).toMatchSnapshot();
  });

  it('loads using readValue correctly', async () => {
    const value = await new FallbackSource([
      new LiteralSource({ foo: 1 }),
      new LiteralSource({ bar: 2 }),
      new LiteralSource({ baz: 3 }),
    ]).readValue();

    expect(value).toEqual({ foo: 1 });
  });
});

describe('stringify', () => {
  it('stringifies JSON', () => {
    expect(stringify({ foo: 'bar' }, FileType.JSON)).toMatchSnapshot();
  });

  it('stringifies JSON5', () => {
    expect(stringify({ foo: 'bar' }, FileType.JSON5)).toMatchSnapshot();
  });

  it('stringifies YAML', () => {
    expect(stringify({ foo: 'bar' }, FileType.YAML)).toMatchSnapshot();
  });

  it('stringifies TOML', () => {
    expect(stringify({ foo: 'bar' }, FileType.TOML)).toMatchSnapshot();
  });

  it('stringifies RAW', () => {
    // RAW only stringifies primitive values
    expect(stringify(11, FileType.RAW)).toMatchSnapshot();
    expect(stringify('foobar', FileType.RAW)).toMatchSnapshot();
    expect(stringify(true, FileType.RAW)).toMatchSnapshot();
  });
});
