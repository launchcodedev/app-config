import { isNode, isObject, isPrimitive } from './index';

describe('isNode', () => {
  it('detects node.js env', () => {
    expect(isNode).toBe(true);
  });
});

describe('isObject', () => {
  it('marks an object as an object', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject('foobar')).toBe(false);
  });
});

describe('isPrimitive', () => {
  it('marks primitives as such', () => {
    expect(isPrimitive(null)).toBe(true);
    expect(isPrimitive(42)).toBe(true);
    expect(isPrimitive('foobar')).toBe(true);
    expect(isPrimitive([])).toBe(false);
    expect(isPrimitive({})).toBe(false);
  });
});
