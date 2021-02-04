import readline from 'readline';
import prompts from 'prompts';
import type { PromptObject } from 'prompts';
import { logger } from './logging';
import { AppConfigError } from './errors';

export type PromiseOrNot<T> = Promise<T> | T;

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

export type KeyFormatter = (key: string, separator: string) => string;

export function camelToScreamingCase(key: string, separator: string = '_'): string {
  return key
    .replace(/([^A-Z]+)([A-Z][a-z])/g, `$1${separator}$2`)
    .replace(/([^0-9]+)([0-9]+)/g, `$1${separator}$2`)
    .replace(/-/g, separator)
    .toUpperCase();
}

export function flattenObjectTree(
  obj: JsonObject,
  prefix: string = '',
  separator: string = '_',
  formatter: KeyFormatter = camelToScreamingCase,
): { [key: string]: string } {
  return Object.entries(obj).reduce((merged, [key, value]) => {
    const flatKey = `${prefix}${prefix ? separator : ''}${formatter(key, separator)}`;

    let flattenedObject;

    if (isObject(value)) {
      flattenedObject = flattenObjectTree(value, flatKey, separator, formatter);
    } else if (Array.isArray(value)) {
      const flattenedArray = value.reduce<JsonObject>((acc, val, ind) => {
        return Object.assign(acc, { [ind]: val });
      }, {});

      flattenedObject = flattenObjectTree(flattenedArray, flatKey, separator, formatter);
    } else {
      flattenedObject = {
        [flatKey]: value,
      };
    }

    return Object.assign(merged, flattenedObject);
  }, {});
}

export function renameInFlattenedTree(
  flattened: { [key: string]: string },
  renames: string[] = [],
  keepOriginalKeys = false,
): typeof flattened {
  for (const rename of renames) {
    const matched = /^(.*)=(.*)$/.exec(rename);

    if (matched) {
      const [, renameFrom, renameTo] = matched;
      if (flattened[renameFrom]) {
        flattened[renameTo] = flattened[renameFrom]; // eslint-disable-line no-param-reassign

        if (!keepOriginalKeys) {
          delete flattened[renameFrom]; // eslint-disable-line no-param-reassign
        }
      } else {
        logger.warn(`A rename was used ('${rename}'), but no value was found.`);
      }
    } else {
      logger.warn(`A rename was used ('${rename}'), but not in correct format.`);
    }
  }

  return flattened;
}

export async function promptUser<T>(options: Omit<PromptObject, 'name'>): Promise<T> {
  const { named } = await prompts({ ...options, name: 'named' });

  return named as T;
}

export async function promptUserWithRetry<T>(
  options: Omit<PromptObject, 'name'>,
  tryAnswer: (answer: T) => Promise<boolean | Error>,
  retries = 3,
): Promise<void> {
  for (let retry = 0; retry < retries; retry += 1) {
    const answer = await promptUser<T>(options);
    const check = await tryAnswer(answer);

    if (check === true) {
      return;
    }

    logger.error(check.toString());
  }

  return Promise.reject(new AppConfigError(`Prompt failed after ${retries} retries`));
}

export async function consumeStdin(): Promise<string> {
  return new Promise((resolve, reject) => {
    const rl = readline.createInterface({ input: process.stdin });

    let buffer = '';
    rl.on('line', (line) => {
      buffer += line;
    });

    rl.on('error', reject);
    rl.on('close', () => resolve(buffer));
  });
}

export const isBrowser =
  typeof window === 'object' && typeof document === 'object' && document.nodeType === 9;

export const isNode = typeof process !== 'undefined';
export const isWindows = isNode && /^win/.test(process.platform);
