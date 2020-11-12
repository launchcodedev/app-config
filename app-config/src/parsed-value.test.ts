import { LiteralSource } from './config-source';
import { parseValue, ParsedValue, ParsingExtension, InObject } from './parsed-value';

describe('parseValue', () => {
  it('parses an empty object with no extensions', async () => {
    const source = new LiteralSource({});
    const parsed = await parseValue(await source.readValue(), source, []);

    expect(parsed.raw).toEqual({});
    expect(parsed.toJSON()).toEqual({});
    expect(parsed.meta).toEqual({});
  });

  it('parses an object with no extensions', async () => {
    const source = new LiteralSource({ a: true, b: {}, c: [] });
    const parsed = await parseValue(await source.readValue(), source, []);

    expect(parsed.raw).toEqual({ a: true, b: {}, c: [] });
    expect(parsed.toJSON()).toEqual({ a: true, b: {}, c: [] });
    expect(parsed.meta).toEqual({});
  });

  it('tracks ConfigSource to nested properties', async () => {
    const source = new LiteralSource({ a: { b: { c: [0] } } });
    const parsed = await parseValue(await source.readValue(), source, []);

    expect(parsed.property(['a'])!.source).toBe(source);
    expect(parsed.property(['a', 'b'])!.source).toBe(source);
    expect(parsed.property(['a', 'b', 'c'])!.source).toBe(source);
    expect(parsed.property(['a', 'b', 'c', '0'])!.source).toBe(source);
  });

  it('writes metadata to parsed value', async () => {
    const source = new LiteralSource({ a: true });
    const parsed = await parseValue(await source.readValue(), source, [], { special: true });

    expect(parsed.meta).toEqual({ special: true });
    expect(parsed.property(['a'])!.meta).toEqual({});
  });

  const markAllExtension: ParsingExtension = (value) => {
    return (parse) => parse(value, { marked: true });
  };

  const markKeyExtension: ParsingExtension = (value, [keyType, key]) => {
    if (keyType === InObject && key === '$mark') {
      return (parse) => parse(value, { shouldFlatten: true, marked: true });
    }

    return false;
  };

  const uppercaseExtension: ParsingExtension = (value) => {
    if (typeof value === 'string') {
      const uppercase = value.toUpperCase();

      return (parse) => parse(uppercase);
    }

    return false;
  };

  const secretExtension: ParsingExtension = (_, [keyType, key]) => {
    if (keyType === InObject && key === '$secret') {
      return (parse) => parse('revealed!', { shouldFlatten: true });
    }

    return false;
  };

  const mergeExtension: ParsingExtension = (value, [keyType, key]) => {
    if (keyType === InObject && key === '$merge') {
      return (parse) => parse(value, { shouldMerge: true });
    }

    return false;
  };

  const overrideExtension: ParsingExtension = (value, [keyType, key]) => {
    if (keyType === InObject && key === '$override') {
      return (parse) => parse(value, { shouldOverride: true });
    }

    return false;
  };

  it('applies a value-based extension', async () => {
    const source = new LiteralSource({ a: { b: 'foo' }, b: 'bar', c: ['baz', 'qux'] });
    const parsed = await parseValue(await source.readValue(), source, [uppercaseExtension]);

    expect(parsed.toJSON()).toEqual({ a: { b: 'FOO' }, b: 'BAR', c: ['BAZ', 'QUX'] });
  });

  it('applies a key-based extension', async () => {
    const source = new LiteralSource({ a: { $secret: 'encoded' } });
    const parsed = await parseValue(await source.readValue(), source, [secretExtension]);

    expect(parsed.toJSON()).toEqual({ a: 'revealed!' });
  });

  it('applies a "marking" extension', async () => {
    const source = new LiteralSource({ a: { b: true }, c: true });
    const parsed = await parseValue(await source.readValue(), source, [markAllExtension]);

    expect(parsed.toJSON()).toEqual({ a: { b: true }, c: true });
    expect(parsed.meta).toEqual({ marked: true });
    expect(parsed.property(['a'])!.meta).toEqual({ marked: true });
    expect(parsed.property(['a', 'b'])!.meta).toEqual({ marked: true });
    expect(parsed.property(['c'])!.meta).toEqual({ marked: true });
  });

  it('passes metadata in a "marking" extension', async () => {
    const value = await ParsedValue.parseLiteral(
      {
        a: {
          b: {
            $mark: {
              c: true,
            },
          },
        },
      },
      [markKeyExtension],
    );

    expect(value.property(['a'])?.meta).toEqual({});
    expect(value.property(['a', 'b'])?.meta).toEqual({ marked: true });
    expect(value.property(['a', 'b', 'c'])?.meta).toEqual({});

    expect(value.property(['a'])?.toJSON()).toEqual({ b: { c: true } });
    expect(value.property(['a', 'b'])?.toJSON()).toEqual({ c: true });
    expect(value.property(['a', 'b', 'c'])?.toJSON()).toEqual(true);
  });

  it('applies a merging extension', async () => {
    const source = new LiteralSource({ $merge: { a: false }, a: true, b: true });
    const parsed = await parseValue(await source.readValue(), source, [mergeExtension]);

    expect(parsed.toJSON()).toEqual({ a: true, b: true });
  });

  it('applies a deep merging extension', async () => {
    const source = new LiteralSource({
      $merge: { a: false, c: { d: true, e: false } },
      a: true,
      b: true,
      c: { e: true },
    });

    const parsed = await parseValue(await source.readValue(), source, [mergeExtension]);

    expect(parsed.toJSON()).toEqual({ a: true, b: true, c: { d: true, e: true } });
  });

  it('applies an override extension', async () => {
    const source = new LiteralSource({ $override: { a: true }, a: false, b: true });
    const parsed = await parseValue(await source.readValue(), source, [overrideExtension]);

    expect(parsed.toJSON()).toEqual({ a: true, b: true });
  });

  it('applies an override extension', async () => {
    const source = new LiteralSource({
      $override: { a: true, c: { d: true, e: true } },
      a: false,
      b: true,
      c: { e: false },
    });

    const parsed = await parseValue(await source.readValue(), source, [overrideExtension]);

    expect(parsed.toJSON()).toEqual({ a: true, b: true, c: { d: true, e: true } });
  });

  it('allows the same extension to be applied twice', async () => {
    const source = new LiteralSource('string');
    const parsed = await parseValue(await source.readValue(), source, [
      uppercaseExtension,
      uppercaseExtension,
    ]);

    expect(parsed.toJSON()).toEqual('STRING');
  });

  it('allows the same extension apply at different levels of a tree', async () => {
    const source = new LiteralSource({ $merge: { $merge: { a: true }, b: true }, c: true });
    const parsed = await parseValue(await source.readValue(), source, [mergeExtension]);

    expect(parsed.toJSON()).toEqual({ a: true, b: true, c: true });
  });
});

describe('ParsedValue', () => {
  it('creates a value from literal JSON', () => {
    const _ = ParsedValue.literal({});
  });

  it('can look up property by name using json-like syntax', () => {
    const value = ParsedValue.literal({ a: { b: { c: true } } });

    expect(value.property(['a', 'b', 'c'])!.toJSON()).toEqual(true);
    expect(value.property(['a', 'b'])!.toJSON()).toEqual({ c: true });
    expect(value.property(['a'])!.toJSON()).toEqual({ b: { c: true } });
    expect(value.property(['c'])).toBeUndefined();
    expect(value.property(['a', 'c'])).toBeUndefined();
  });

  it('can look up property in array', () => {
    const value = ParsedValue.literal({ a: { b: [1, 2, 3] } });

    expect(value.property(['a', 'b'])!.toJSON()).toEqual([1, 2, 3]);
    expect(value.property(['a', 'b', '0'])!.toJSON()).toEqual(1);
    expect(value.property(['a', 'b', '2'])!.toJSON()).toEqual(3);
  });

  it('creates a deep clone in toJSON', () => {
    const literal = { a: { b: { c: true } } };
    const value = ParsedValue.literal(literal);
    const jsonified = value.toJSON() as typeof literal;

    // raw value is the same
    expect(value.raw).toBe(literal);

    // equal, but not the same
    expect(jsonified).toEqual(literal);
    expect(jsonified).not.toBe(literal);
    expect(jsonified.a).not.toBe(literal.a);
    expect(jsonified.a.b).not.toBe(literal.a.b);
  });

  it('resolves asArray correctly', () => {
    expect(ParsedValue.literal({}).asArray()).toBeUndefined();
    expect(ParsedValue.literal(null).asArray()).toBeUndefined();
    expect(ParsedValue.literal(42).asArray()).toBeUndefined();
    expect(ParsedValue.literal('foo').asArray()).toBeUndefined();

    expect(ParsedValue.literal([1, 2, 3]).asArray()).toHaveLength(3);
  });

  it('resolves asPrimitive correctly', () => {
    expect(ParsedValue.literal({}).asPrimitive()).toBeUndefined();
    expect(ParsedValue.literal([1, 2, 3]).asPrimitive()).toBeUndefined();

    expect(ParsedValue.literal(null).asPrimitive()).toEqual(null);
    expect(ParsedValue.literal(42).asPrimitive()).toEqual(42);
    expect(ParsedValue.literal('foo').asPrimitive()).toEqual('foo');
  });

  it('resolves asObject correctly', () => {
    expect(ParsedValue.literal({}).asObject()).toEqual({});
    expect(ParsedValue.literal([1, 2, 3]).asObject()).toBeUndefined();
    expect(ParsedValue.literal(null).asObject()).toBeUndefined();
    expect(ParsedValue.literal(42).asObject()).toBeUndefined();
    expect(ParsedValue.literal('foo').asObject()).toBeUndefined();
  });

  describe('Merging', () => {
    it('merges two parsed values', () => {
      const a = ParsedValue.literal({ a: { b: { c: true } } });
      const b = ParsedValue.literal({ a: { b: { d: true } } });
      const merged = ParsedValue.merge(a, b);

      expect(a.toJSON()).toEqual({ a: { b: { c: true } } });
      expect(b.toJSON()).toEqual({ a: { b: { d: true } } });
      expect(merged.raw).toEqual({ a: { b: { c: true, d: true } } });
      expect(merged.toJSON()).toEqual({ a: { b: { c: true, d: true } } });
    });

    it('overrides properties when merging', () => {
      const a = ParsedValue.literal({ a: true, b: true });
      const b = ParsedValue.literal({ a: { b: { d: true } } });
      const value = ParsedValue.merge(a, b);

      expect(a).not.toEqual(value);
      expect(b).not.toEqual(value);
      expect(a.toJSON()).not.toEqual(value.toJSON());
      expect(b.toJSON()).not.toEqual(value.toJSON());
      expect(value.toJSON()).toEqual({ a: { b: { d: true } }, b: true });
    });

    it('overrides arrays when merging', () => {
      const a = ParsedValue.literal({ a: [] });
      const b = ParsedValue.literal({ a: {} });

      expect(ParsedValue.merge(a, b).toJSON()).toEqual({ a: {} });
      expect(ParsedValue.merge(b, a).toJSON()).toEqual({ a: [] });
    });

    it('merges meta properties', () => {
      const a = ParsedValue.literal({ a: true }).assignMeta({ specialK: true });
      const b = ParsedValue.literal({ b: true }).assignMeta({ specialP: true });
      const value = ParsedValue.merge(a, b);

      expect(value.toJSON()).toEqual({ a: true, b: true });
      expect(value.meta).toEqual({ specialK: true, specialP: true });
    });

    it('merges meta properties in nested properties', () => {
      const a = ParsedValue.literal({ a: true });
      const b = ParsedValue.literal({ b: true });

      a.property(['a'])?.assignMeta({ specialProperty: true });
      b.property(['b'])?.assignMeta({ specialProperty: false });

      const merged = ParsedValue.merge(a, b);
      expect(merged.property(['a'])?.meta).toEqual({ specialProperty: true });
      expect(merged.property(['b'])?.meta).toEqual({ specialProperty: false });
    });
  });
});
