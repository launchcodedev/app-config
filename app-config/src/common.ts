import readline from 'readline';
import prompts from 'prompts';

export type PromiseOrNot<T> = Promise<T> | T;

export type JsonPrimitive = number | string | boolean | null;

export interface JsonObject {
  [key: string]: Json;
}

export interface JsonArray extends Array<Json> {}

export type Json = JsonPrimitive | JsonArray | JsonObject;

export function isObject(obj: Json): obj is JsonObject {
  return typeof obj === 'object' && obj !== null;
}

export type KeyFormatter = (key: string, separator: string) => string;

export const camelToScreamingCase: KeyFormatter = (key: string, separator: string) => {
  // splits on capital letters, joins with a separator, and converts to uppercase
  return key
    .split(/(?=[A-Z])/)
    .join(separator)
    .replace(/-/g, separator)
    .toUpperCase();
};

export const flattenObjectTree = (
  obj: JsonObject,
  prefix: string = '',
  separator: string = '_',
  formatter: KeyFormatter = camelToScreamingCase,
): { [key: string]: string } => {
  return Object.entries(obj).reduce((merged, [key, value]) => {
    const flatKey = `${prefix}${prefix && separator}${formatter(key, separator)}`;

    let flattenedObject;

    if (isObject(value)) {
      flattenedObject = flattenObjectTree(value, flatKey, separator, formatter);
    } else {
      flattenedObject = {
        [flatKey]: value,
      };
    }

    return Object.assign(merged, flattenedObject);
  }, {});
};

export async function promptUser<T>(o: Omit<prompts.PromptObject, 'name'>): Promise<T> {
  const { named } = await prompts({ ...o, name: 'named' });

  return named as T;
}

export async function consumeStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin });

    let buffer = '';
    rl.on('error', reject);
    rl.on('line', (line) => {
      buffer += line;
    });

    rl.on('close', () => {
      resolve(buffer);
    });
  });
}
