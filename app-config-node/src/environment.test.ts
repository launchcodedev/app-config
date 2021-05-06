import {
  currentEnvironment,
  aliasesFor,
  asEnvOptions,
  defaultAliases,
  defaultEnvVarNames,
} from './environment';

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

    expect(currentEnvironment({ envVarNames: ['FOO', 'BAR'], aliases: defaultAliases })).toBe(
      'bar',
    );
    expect(currentEnvironment({ envVarNames: ['BAR'], aliases: defaultAliases })).toBe(undefined);
  });

  it('uses aliases', () => {
    process.env.FOO = 'bar';
    process.env.NODE_ENV = 'bar';

    expect(currentEnvironment({ envVarNames: ['FOO'], aliases: defaultAliases })).toBe('bar');
    expect(currentEnvironment({ aliases: { bar: 'foo' }, envVarNames: defaultEnvVarNames })).toBe(
      'foo',
    );
    expect(currentEnvironment({ aliases: { bar: 'foo' }, envVarNames: ['FOO'] })).toBe('foo');
  });

  it('uses override', () => {
    process.env.NODE_ENV = 'foo';
    expect(currentEnvironment({})).toBe('foo');
    expect(currentEnvironment({ override: 'bar' })).toBe('bar');
  });
});

describe('aliasesFor', () => {
  it('reverse lookups', () => {
    expect(aliasesFor('foo', { bar: 'foo', baz: 'qux' })).toEqual(['bar']);
    expect(aliasesFor('foo', { bar: 'foo', baz: 'foo' })).toEqual(['bar', 'baz']);
  });
});

describe('asEnvOptions', () => {
  it('reads environmentSourceNames string', () => {
    expect(asEnvOptions(undefined, undefined, 'foo')).toEqual({
      envVarNames: ['foo'],
      aliases: defaultAliases,
    });
  });

  it('reads environmentSourceNames strings', () => {
    expect(asEnvOptions(undefined, undefined, ['foo'])).toEqual({
      envVarNames: ['foo'],
      aliases: defaultAliases,
    });
  });
});
