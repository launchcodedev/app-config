import { JsonObject, isObject } from '@app-config/utils';
import { logger } from '@app-config/logging';

export type KeyFormatter = (key: string, separator: string) => string;

/** Strategy used in 'app-config vars' for variable names */
export function camelToScreamingCase(key: string, separator: string = '_'): string {
  return key
    .replace(/([^A-Z]+)([A-Z][a-z])/g, `$1${separator}$2`)
    .replace(/([^0-9]+)([0-9]+)/g, `$1${separator}$2`)
    .replace(/-/g, separator)
    .toUpperCase();
}

/** Strategy used in 'app-config vars' to extract variable names from hierachy */
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

/** Strategy for renaming keys, used for 'app-config vars' */
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
