import { flattenObjectTree, KeyFormatter, camelToScreamingCase } from './util';

const person = {
  name: 'bob',
  favouriteFood: 'cheese',
  bestFriend: {
    name: 'steve',
    favouriteFood: 'pizza',
  },
};

const restaurant = {
  foods: ['pasta', 'pizza', 'taco', 'salad'],
};

const zoo = {
  giraffe: {
    name: 'Gerald',
    legCount: 4,
  },
  elephant: {
    name: 'Steve',
    legCount: 4,
  },
  lion: {
    name: 'Fredrick',
    legCount: 4,
  },
  penguin: {
    name: 'Todd',
    legCount: 2,
  },
  stegosaurus: null,
  unicorn: undefined,
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
      return key.replace(/[aeiou]/gi, '').toLowerCase();
    };

    const flattenedObject = flattenObjectTree(person, '', '_', stripVowels);

    const keys = Object.keys(flattenedObject);

    expect(keys).toContain('nm');
    expect(keys).toContain('fvrtfd');
    expect(keys).toContain('bstfrnd_nm');
    expect(keys).toContain('bstfrnd_fvrtfd');
  });

  test('Object with null property produces null flattened property', () => {
    const flattenedObject = flattenObjectTree(zoo);

    expect(flattenedObject).toMatchObject({
      STEGOSAURUS: null,
    });
  });

  test('Object with undefined property produces undefined flattened property', () => {
    const flattenedObject = flattenObjectTree(zoo);

    expect(flattenedObject).toMatchObject({
      UNICORN: undefined,
    });
  });
});

describe('camelToSeperator()', () => {
  test('String in camelCase is converted to underscore_case', () => {
    const originalString = 'testVariableName';

    const modifiedString = camelToScreamingCase(originalString, '_');

    expect(modifiedString).toBe('TEST_VARIABLE_NAME');
  });
  test('String in camelCase is converted to kebab-case', () => {
    const originalString = 'testVariableName';

    const modifiedString = camelToScreamingCase(originalString, '-');

    expect(modifiedString).toBe('TEST-VARIABLE-NAME');
  });
});
