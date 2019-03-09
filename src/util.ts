import { join } from 'path';
import * as fs from 'fs-extra';

export type KeyFormatter = (key: string, separator: string) => string;

export const camelToScreamingCase: KeyFormatter = (key: string, separator: string) => {
  // splits on capital letters, joins with a separator, and converts to uppercase
  return key
    .split(/(?=[A-Z])/)
    .join(separator)
    .toUpperCase();
};

export const flattenObjectTree = (
  obj: object,
  prefix: string = '',
  separator: string = '_',
  formatter: KeyFormatter = camelToScreamingCase,
): { [key: string]: string } => {
  return Object.entries(obj).reduce((merged, [key, value]) => {
    const flatKey = `${prefix}${prefix && separator}${formatter(key, separator)}`;

    let flattenedObject;
    if (value !== undefined && value !== null && typeof value === 'object') {
      flattenedObject = flattenObjectTree(value, flatKey, separator, formatter);
    } else {
      flattenedObject = {
        [flatKey]: value,
      };
    }

    return Object.assign(merged, flattenedObject);
  }, {});
};

export const findPackageRoot = async (cwd = process.cwd()): Promise<string> => {
  if (!(await fs.pathExists(join(cwd, 'package.json')))) {
    if (join(cwd, '..') === cwd) {
      throw new Error('no package root found in pwd or its parents');
    }

    return findPackageRoot(join(cwd, '..'));
  }

  return cwd;
};

export const findPackageRootSync = (cwd = process.cwd()): string => {
  if (!fs.pathExistsSync(join(cwd, 'package.json'))) {
    if (join(cwd, '..') === cwd) {
      throw new Error('no package root found in pwd or its parents');
    }

    return findPackageRootSync(join(cwd, '..'));
  }

  return cwd;
};
