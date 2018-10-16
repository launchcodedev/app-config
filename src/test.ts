import * as fs from 'fs-extra';

describe('config', () => {
  beforeAll(() => {
    process.chdir('/tmp');
  });

  test('loads json schema', () => {
    fs.writeFileSync('.app-config.toml', `
      firstName = "John"
      lastName = "Doe"
      age = 33
    `);
    fs.writeFileSync('.app-config.schema.json', `
      {
        "$id": "https://example.com/person.schema.json",
        "$schema": "http://json-schema.org/draft-07/schema#",
        "title": "Person",
        "type": "object",
        "required": [ "firstName", "lastName", "age" ],
        "properties": {
          "firstName": {
            "type": "string",
            "description": "The person's first name."
          },
          "lastName": {
            "type": "string",
            "description": "The person's last name."
          },
          "age": {
            "description": "Age in years which must be equal to or greater than zero.",
            "type": "integer",
            "minimum": 0
          }
        }
      }
    `);

    require('./index').validate();

    fs.removeSync('.app-config.toml');
    fs.removeSync('.app-config.schema.json');
  });

  test('loads toml schema', () => {
    fs.writeFileSync('.app-config.toml', ``);
    fs.writeFileSync('.app-config.schema.toml', ``);

    require('./index').validate();

    fs.removeSync('.app-config.toml');
    fs.removeSync('.app-config.schema.toml');
  });

  test('rejects invalid toml schema', () => {
    fs.writeFileSync('.app-config.toml', `
      firstName = "John"
      age = 33
    `);
    fs.writeFileSync('.app-config.schema.toml', `
      "$id" = "https://example.com/person.schema.json"
      "$schema" = "http://json-schema.org/draft-07/schema#"
      title = "Person"
      type = "object"
      required = [ "firstName", "lastName", "age" ]

      [properties.firstName]
      type = "string"
      description = "The person's first name."

      [properties.lastName]
      type = "string"
      description = "The person's last name."

      [properties.age]
      description = "Age in years which must be equal to or greater than zero."
      type = "integer"
      minimum = 0
    `);

    expect(() => require('./index').validate()).toThrow();

    fs.removeSync('.app-config.toml');
    fs.removeSync('.app-config.schema.toml');
  });
});
