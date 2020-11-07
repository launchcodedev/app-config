import { ParsedValue } from './parsed-value';

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
});
