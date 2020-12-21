import { logger } from './logging';

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

export const isBrowser =
  typeof window === 'object' && typeof document === 'object' && document.nodeType === 9;

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
