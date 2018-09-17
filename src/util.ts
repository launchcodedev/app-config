export type KeyFormatter = (key: string, separator: string) => string;

export const camelToSeparator: KeyFormatter = (key: string, separator: string) => {
  return key.split(/(?=[A-Z])/).join(separator).toUpperCase();
};

export const flattenObjectTree = (
  object: object,
  prefix: string = '',
  separator: string = '_',
  keyFormatter: KeyFormatter = camelToSeparator,
) => {
  return Object.entries(object).reduce(
    (merged, [key, value]) => {
      const flattenedKey = `${prefix}${prefix && separator}${keyFormatter(key, separator)}`;
      let flattenedObject = {};

      if (typeof value === 'object') {
        flattenedObject = flattenObjectTree(value, flattenedKey, separator);
      } else {
        flattenedObject = {
          [flattenedKey]: value,
        };
      }

      return {
        ...merged,
        ...flattenedObject,
      };
    },
    {},
  );
};
