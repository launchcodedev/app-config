import { currentEnvironment } from './environment';

describe('currentEnvironment', () => {
  describe('deprecated currentEnvironment', () => {
    it('uses environmentSourceNames', () => {
      process.env.NODE_ENV = 'foo';
      process.env.FOO = 'bar';

      expect(currentEnvironment(undefined, ['FOO', 'BAR'])).toBe('bar');
      expect(currentEnvironment(undefined, ['BAR'])).toBe(undefined);
    });

    it('uses environmentAliases', () => {
      process.env.FOO = 'bar';
      process.env.NODE_ENV = 'bar';

      expect(currentEnvironment({}, ['FOO'])).toBe('bar');
      expect(currentEnvironment({ bar: 'foo' })).toBe('foo');
      expect(currentEnvironment({ bar: 'foo' }, ['FOO'])).toBe('foo');
    });
  });

  it('uses envVarNames', () => {
    process.env.NODE_ENV = 'foo';
    process.env.FOO = 'bar';

    expect(currentEnvironment({ envVarNames: ['FOO', 'BAR'] })).toBe('bar');
    expect(currentEnvironment({ envVarNames: ['BAR'] })).toBe(undefined);
  });

  it('uses aliases', () => {
    process.env.FOO = 'bar';
    process.env.NODE_ENV = 'bar';

    expect(currentEnvironment({ envVarNames: ['FOO'] })).toBe('bar');
    expect(currentEnvironment({ aliases: { bar: 'foo' } })).toBe('foo');
    expect(currentEnvironment({ aliases: { bar: 'foo' }, envVarNames: ['FOO'] })).toBe('foo');
  });

  it('uses override', () => {
    process.env.NODE_ENV = 'foo';
    expect(currentEnvironment({})).toBe('foo');
    expect(currentEnvironment({ override: 'bar' })).toBe('bar');
  });
});
