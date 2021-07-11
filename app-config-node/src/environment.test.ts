import {
  currentEnvironment,
  aliasesFor,
  asEnvOptions,
  defaultAliases,
  defaultEnvVarNames,
} from './environment';

describe('currentEnvironment', () => {
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
    expect(currentEnvironment()).toBe('foo');
    expect(
      currentEnvironment({
        override: 'bar',
        aliases: defaultAliases,
        envVarNames: defaultEnvVarNames,
      }),
    ).toBe('bar');
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
