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
