export const isBrowser =
  typeof window === 'object' && typeof document === 'object' && document.nodeType === 9;

export const isNode = typeof process !== 'undefined' && !isBrowser;
export const isWindows = isNode && /^win/.test(process.platform);

export const packageNameRegex =
  /(^@(lcdev|servall)\/app-config)|(^@app-config\/main)|(\.?app-config(\.\w+)?\.(toml|yml|yaml|json|json5))|(\.config-placeholder)/;

export type JsonPrimitive = number | string | boolean | null;

export interface JsonObject {
  [key: string]: Json;
}

export interface JsonArray extends Array<Json> {}

export type Json = JsonPrimitive | JsonArray | JsonObject;

export function isObject(obj: Json): obj is JsonObject {
  return typeof obj === 'object' && !Array.isArray(obj) && obj !== null;
}

export function isPrimitive(obj: Json): obj is JsonPrimitive {
  return !isObject(obj) && !Array.isArray(obj);
}

export function generateModuleText(
  fullConfig: Json,
  {
    esm,
    noGlobal,
    currentEnvironment,
    validationFunctionCode,
  }: {
    esm: boolean;
    noGlobal: boolean;
    currentEnvironment: string | undefined;
    validationFunctionCode?(): string;
    validationFunctionCode?(esm: true): [string, string];
  },
): string {
  const privateName = '_appConfig';
  const config = JSON.stringify(fullConfig);

  let generatedText: string;

  if (noGlobal) {
    generatedText = `
      const config = ${config};

      export { config };
      export default config;
    `;
  } else {
    generatedText = `
      const configValue = ${config};

      const globalNamespace = (typeof window === 'undefined' ? globalThis : window) || {};

      // if the global was already defined, use it
      const config = (globalNamespace.${privateName} || configValue);

      // if the global is frozen then it was set by electron and we can't change it, but we'll set it if we can
      if (
        typeof globalNamespace.${privateName} === 'undefined' ||
        !Object.isFrozen(globalNamespace.${privateName})
      ) {
        globalNamespace.${privateName} = config;
      }

      export { config };
      export default config;
    `;
  }

  if (validationFunctionCode) {
    if (esm) {
      const [code, imports] = validationFunctionCode(true);

      generatedText = `${generatedText}
        ${imports}

        ${/* nest the generated commonjs module here */ ''}
        function genValidateConfig(){
          const validateConfigModule = {};
          (function(module){${code}})(validateConfigModule);
          return validateConfigModule.exports;
        }

        ${/* marking as pure allows tree shaking */ ''}
        export const validateConfig = /*#__PURE__*/ genValidateConfig();
      `;
    } else {
      const code = validationFunctionCode();

      generatedText = `${generatedText}
        ${/* nest the generated commonjs module here */ ''}
        function genValidateConfig(){
          const validateConfigModule = {};
          (function(module){${code}})(validateConfigModule);
          return validateConfigModule.exports;
        }

        ${/* marking as pure always allows tree shaking in webpack when using es modules */ ''}
        export const validateConfig = /*#__PURE__*/ genValidateConfig();
      `;
    }
  }

  generatedText = `${generatedText}
    export function currentEnvironment() {
      return ${currentEnvironment ? JSON.stringify(currentEnvironment) : 'undefined'};
    }
  `;

  return generatedText;
}
