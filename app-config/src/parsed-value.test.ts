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
  });
});
