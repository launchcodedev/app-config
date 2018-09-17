import { flattenObjectTree, KeyFormatter, camelToSeparator } from './util';

const person = {
  name: 'bob',
  favouriteFood: 'cheese',
  bestFriend: {
    name: 'steve',
    favouriteFood: 'pizza',
  },
};

const restaurant = {
  foods: [
    'pasta',
    'pizza',
    'taco',
    'salad',
  ],
};

describe('flattenObjectTree()', () => {
  test('Default arguments produces correct flattened tree', () => {
    const flattenedObject = flattenObjectTree(person);

    expect(flattenedObject).toEqual({
      NAME: 'bob',
      FAVOURITE_FOOD: 'cheese',
      BEST_FRIEND_NAME: 'steve',
      BEST_FRIEND_FAVOURITE_FOOD: 'pizza',
    });
  });

  test('Modifying separator produces correct keys', () => {
    const flattenedObject = flattenObjectTree(person, '', '-');

    const keys = Object.keys(flattenedObject);

    expect(keys).toContain('NAME');
    expect(keys).toContain('FAVOURITE-FOOD');
    expect(keys).toContain('BEST-FRIEND-NAME');
    expect(keys).toContain('BEST-FRIEND-FAVOURITE-FOOD');
  });

  test('Arrays produce keys with zero-based integers', () => {
    const flattenedObject = flattenObjectTree(restaurant);

    expect(flattenedObject).toEqual({
      FOODS_0: 'pasta',
      FOODS_1: 'pizza',
      FOODS_2: 'taco',
      FOODS_3: 'salad',
    });
  });

  test('Prefix is added to keys when specified', () => {
    const flattenedObject = flattenObjectTree(person, 'APP_CONFIG');

    const keys = Object.keys(flattenedObject);

    expect(keys).toContain('APP_CONFIG_NAME');
    expect(keys).toContain('APP_CONFIG_FAVOURITE_FOOD');
    expect(keys).toContain('APP_CONFIG_BEST_FRIEND_NAME');
    expect(keys).toContain('APP_CONFIG_BEST_FRIEND_FAVOURITE_FOOD');
  });

  test('Custom key formatter produces expected keys', () => {
    const stripVowels: KeyFormatter = (key: string) => {
      return key
        .replace(/[aeiou]/ig, '')
        .toLowerCase();
    };

    const flattenedObject = flattenObjectTree(person, '', '_', stripVowels);

    const keys = Object.keys(flattenedObject);

    expect(keys).toContain('nm');
    expect(keys).toContain('fvrtfd');
    expect(keys).toContain('bstfrnd_nm');
    expect(keys).toContain('bstfrnd_fvrtfd');
  });
});

describe('camelToSeperator()', () => {
  test('String in camelCase is converted to underscore_case', () => {
    const originalString = 'testVariableName';

    const modifiedString = camelToSeparator(originalString, '_');

    expect(modifiedString).toBe('TEST_VARIABLE_NAME');
  });
  test('String in camelCase is converted to kebab-case', () => {
    const originalString = 'testVariableName';

    const modifiedString = camelToSeparator(originalString, '-');

    expect(modifiedString).toBe('TEST-VARIABLE-NAME');
  });
});
