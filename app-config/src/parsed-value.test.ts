import { ParsedValue } from './parsed-value';
import { FileParsingExtension } from './extensions';

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

  it('creates a deep clone in toJSON', () => {
    const literal = { a: { b: { c: true } } };
    const value = ParsedValue.literal(literal);
    // eslint-disable-next-line
    const jsonified = value.toJSON() as any;

    // raw value is the same
    expect(value.raw).toBe(literal);

    // equal, but not the same
    expect(jsonified).toEqual(literal);
    expect(jsonified).not.toBe(literal);
    expect(jsonified.a).not.toBe(literal.a);
    expect(jsonified.a.b).not.toBe(literal.a.b);
  });

  it('merges two parsed values', () => {
    const a = ParsedValue.literal({ a: { b: { c: true } } });
    const b = ParsedValue.literal({ a: { b: { d: true } } });
    const merged = a.merge(b);

    expect(a.toJSON()).toEqual({ a: { b: { c: true } } });
    expect(b.toJSON()).toEqual({ a: { b: { d: true } } });
    expect(merged.raw).toEqual({ a: { b: { c: true, d: true } } });
    expect(merged.toJSON()).toEqual({ a: { b: { c: true, d: true } } });
  });

  it('overrides properties when merging', () => {
    const a = ParsedValue.literal({ a: true, b: true });
    const b = ParsedValue.literal({ a: { b: { d: true } } });
    const value = a.merge(b);

    expect(a).not.toEqual(value);
    expect(b).not.toEqual(value);
    expect(a.toJSON()).not.toEqual(value.toJSON());
    expect(b.toJSON()).not.toEqual(value.toJSON());
    expect(value.toJSON()).toEqual({ a: { b: { d: true } }, b: true });
  });

  it('merges meta properties', () => {
    const a = ParsedValue.literal({ a: true, b: true }).setMeta({ specialK: true });
    const b = ParsedValue.literal({ a: { b: { d: true } } }).setMeta({ specialP: true });
    const value = a.merge(b);

    expect(value.meta).toEqual({ specialK: true, specialP: true });
  });
});

describe('Extensions', () => {
  it('passes through metadata', async () => {
    const mockExtension: FileParsingExtension = (key, value) => {
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
