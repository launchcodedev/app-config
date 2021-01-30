import {
  isObject,
  isPrimitive,
  camelToScreamingCase,
  flattenObjectTree,
  renameInFlattenedTree,
  promptUserWithRetry,
  consumeStdin,
} from './common';
import { mockedStdin } from './test-util';

describe('isObject', () => {
  it('marks an object as an object', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(false);
    expect(isObject(null)).toBe(false);
    expect(isObject(42)).toBe(false);
    expect(isObject('foobar')).toBe(false);
  });
});

describe('isPrimitive', () => {
  it('marks primitives as such', () => {
    expect(isPrimitive(null)).toBe(true);
    expect(isPrimitive(42)).toBe(true);
    expect(isPrimitive('foobar')).toBe(true);
    expect(isPrimitive([])).toBe(false);
    expect(isPrimitive({})).toBe(false);
  });
});

describe('camelToScreamingCase', () => {
  it('converts a typical camel case name', () => {
    expect(camelToScreamingCase('fooBar')).toBe('FOO_BAR');
    expect(camelToScreamingCase('fooBarBaz')).toBe('FOO_BAR_BAZ');
  });

  it('converts a pascal case name', () => {
    expect(camelToScreamingCase('FooBar')).toBe('FOO_BAR');
  });

  it('uses numbers as delimiters', () => {
    expect(camelToScreamingCase('foo2Bar')).toBe('FOO_2_BAR');
    expect(camelToScreamingCase('foo22Bar')).toBe('FOO_22_BAR');
    expect(camelToScreamingCase('foo2Bar4')).toBe('FOO_2_BAR_4');
    expect(camelToScreamingCase('foo22Bar44')).toBe('FOO_22_BAR_44');
    expect(camelToScreamingCase('22Bar')).toBe('22_BAR');
    expect(camelToScreamingCase('22Bar44')).toBe('22_BAR_44');
    expect(camelToScreamingCase('Foo1B')).toBe('FOO_1B');
    expect(camelToScreamingCase('Foo1BC')).toBe('FOO_1BC');
  });

  it('converts dashes where present', () => {
    expect(camelToScreamingCase('foo-bar')).toBe('FOO_BAR');
  });

  it('keeps screaming case in-tact', () => {
    expect(camelToScreamingCase('FOO_BAR')).toBe('FOO_BAR');
  });

  it('allows using different delimiters', () => {
    expect(camelToScreamingCase('fooBarBaz', '-')).toBe('FOO-BAR-BAZ');
  });
});

describe('flattenObjectTree', () => {
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
    // cast because undefined isn't actually possible in JsonObject
    unicorn: (undefined as unknown) as null,
  };

  it('flattens a basic object', () => {
    const flattenedObject = flattenObjectTree(person);

    expect(flattenedObject).toEqual({
      NAME: 'bob',
      FAVOURITE_FOOD: 'cheese',
      BEST_FRIEND_NAME: 'steve',
      BEST_FRIEND_FAVOURITE_FOOD: 'pizza',
    });
  });

  it('uses provided separator', () => {
    const flattenedObject = flattenObjectTree(person, '', '-');

    const keys = Object.keys(flattenedObject);

    expect(keys).toContain('NAME');
    expect(keys).toContain('FAVOURITE-FOOD');
    expect(keys).toContain('BEST-FRIEND-NAME');
    expect(keys).toContain('BEST-FRIEND-FAVOURITE-FOOD');
  });

  it('formats arrays with index in variable names', () => {
    const flattenedObject = flattenObjectTree(restaurant);

    expect(flattenedObject).toEqual({
      FOODS_0: 'pasta',
      FOODS_1: 'pizza',
      FOODS_2: 'taco',
      FOODS_3: 'salad',
    });
  });

  it('appends prefix to variable names', () => {
    const flattenedObject = flattenObjectTree(person, 'APP_CONFIG');

    const keys = Object.keys(flattenedObject);

    expect(keys).toContain('APP_CONFIG_NAME');
    expect(keys).toContain('APP_CONFIG_FAVOURITE_FOOD');
    expect(keys).toContain('APP_CONFIG_BEST_FRIEND_NAME');
    expect(keys).toContain('APP_CONFIG_BEST_FRIEND_FAVOURITE_FOOD');
  });

  it('uses a custom key formatter', () => {
    const stripVowels = (key: string) => {
      return key.replace(/[aeiou]/gi, '').toLowerCase();
    };

    const flattenedObject = flattenObjectTree(person, '', '_', stripVowels);

    const keys = Object.keys(flattenedObject);

    expect(keys).toContain('nm');
    expect(keys).toContain('fvrtfd');
    expect(keys).toContain('bstfrnd_nm');
    expect(keys).toContain('bstfrnd_fvrtfd');
  });

  it('passes null values through to object', () => {
    const flattenedObject = flattenObjectTree(zoo);

    expect(flattenedObject).toMatchObject({
      STEGOSAURUS: null,
    });
  });

  it('passes undefined values through to object', () => {
    const flattenedObject = flattenObjectTree(zoo);

    expect(flattenedObject).toMatchObject({
      UNICORN: undefined,
    });
  });
});

describe('renameInFlattenedTree', () => {
  it('renames a property name', () => {
    expect(renameInFlattenedTree({ FOO: 'value', BAZ: '42' }, ['FOO=BAR'])).toEqual({
      BAR: 'value',
      BAZ: '42',
    });
  });
});

describe('promptUserWithRetry', () => {
  it('accepts first valid response', async () => {
    await mockedStdin(async (send) => {
      send('bar').catch(() => {});

      await promptUserWithRetry({ type: 'text', message: 'Foo?' }, async (answer) => {
        expect(answer).toBe('bar');

        return true;
      });
    });
  });

  it('rejects after 3 tries', async () => {
    await mockedStdin(async (send) => {
      send('bar')
        .then(() => send('bar'))
        .then(() => send('bar'))
        .catch(() => {});

      await expect(
        promptUserWithRetry({ type: 'text', message: 'Foo?' }, async () => new Error('Nope')),
      ).rejects.toBeTruthy();
    });
  });
});

describe('consumeStdin', () => {
  it('consumes all lines until end', async () => {
    await mockedStdin(async (send, end) => {
      send('foo')
        .then(() => send('bar'))
        .then(() => send('baz'))
        .then(() => end())
        .catch(() => {});

      // we expect newlines to be eaten up, since this function is used for html and base64 data
      expect(await consumeStdin()).toBe('foobarbaz');
    });
  });
});
