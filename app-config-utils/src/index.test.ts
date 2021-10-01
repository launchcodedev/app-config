import { isNode, isObject, isPrimitive, generateModuleText } from './index';

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

describe('generateModuleText', () => {
  it('creates config module', () => {
    expect(
      generateModuleText(
        {
          foo: 'bar',
        },
        {
          environment: 'test',
          useGlobalNamespace: false,
          esmValidationCode: false,
          validationFunctionCode: undefined,
        },
      ),
    ).toMatchSnapshot();
  });

  it('creates config module with global namespace', () => {
    expect(
      generateModuleText(
        {
          foo: 'bar',
        },
        {
          environment: 'test',
          useGlobalNamespace: true,
          esmValidationCode: false,
          validationFunctionCode: undefined,
        },
      ),
    ).toMatchSnapshot();
  });

  it('creates config module with noBundledConfig', () => {
    expect(
      generateModuleText('no-config', {
        environment: 'test',
        useGlobalNamespace: true,
        esmValidationCode: false,
        validationFunctionCode: undefined,
      }),
    ).toMatchSnapshot();
  });

  it('creates config module with validation function', () => {
    expect(
      generateModuleText(
        {
          foo: 'bar',
        },
        {
          environment: 'test',
          useGlobalNamespace: true,
          esmValidationCode: false,
          // @ts-ignore
          validationFunctionCode: () => {
            return `
              const foo = 'bar';
            `;
          },
        },
      ),
    ).toMatchSnapshot();
  });

  it('creates config module with esm validation function', () => {
    expect(
      generateModuleText(
        {
          foo: 'bar',
        },
        {
          environment: 'test',
          useGlobalNamespace: true,
          esmValidationCode: true,
          // @ts-ignore
          validationFunctionCode: () => {
            return ['import foo from "bar";', `const foo = 'bar';`];
          },
        },
      ),
    ).toMatchSnapshot();
  });
});
