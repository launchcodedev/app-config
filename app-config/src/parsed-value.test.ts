import { ParsedValue } from './parsed-value';
import { ParsingExtension } from './extensions';

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

describe('Extensions', () => {
  it('passes through metadata', async () => {
    const mockExtension: ParsingExtension = (key, value) => {
      if (key !== '$mock') return false;
      return () => {
        return [value, { metadata: { newProperty: true }, flatten: true, merge: true }];
      };
    };

    const value = await ParsedValue.parseLiteral(
      {
        a: {
          b: {
            $mock: {
              c: true,
            },
          },
        },
      },
      [mockExtension],
    );

    expect(value.property(['a'])?.meta).toEqual({});
    expect(value.property(['a', 'b'])?.meta).toEqual({ newProperty: true });
    expect(value.property(['a', 'b', 'c'])?.meta).toEqual({});

    expect(value.property(['a'])?.toJSON()).toEqual({ b: { c: true } });
    expect(value.property(['a', 'b'])?.toJSON()).toEqual({ c: true });
    expect(value.property(['a', 'b', 'c'])?.toJSON()).toEqual(true);
  });
});
