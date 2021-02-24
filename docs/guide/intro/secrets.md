---
title: Secret Value Files
---

## Secret Value Files

Configuration can include sensitive values of all kinds. A private key, a
3rd-party API token, a database password, etc. Anything that should not be
committed in git is a "secret".

App Config has two ways to think about and deal with secrets. Secret files and [encrypted values](./encryption.md).

The simpler of the two is secret files. These are exactly the same as configuration
files, they just get stored in a different file, `.app-config.secrets.{ext}`. The filepath is the
only difference, from the perspective of App Config. The values are [treated differently
during validation though](./schema-validation.md#marking-secret-properties).

The difference for you as a user is in version control. These files should always
be ignored so they are never committed. The following ignore pattern is liberal,
but probably what you want to use as a convention anyways.

<h4 style="text-align:center">.gitignore</h4>

```
*.secrets.*
```

<br />

A few notes about secret files:

- Values in secret files are merged (deeply) with main config files. Secrets take precedent.
- Values that are read from secret files are allowed with schema `secret: true` properties.
- Secret files are not loaded when `APP_CONFIG` environment variable is read.

You may never need secret files if you're using [encryption](./encryption.md) for all values.
Otherwise, they're a handy way to split up configuration. "Secret" vs "Not Secret" tends to be
a good boundary for values either way.

## Example App

For the sake of "showing not telling", here is a typical set of config files.

<h4 style="text-align:center">.app-config.schema.yml</h4>

```yaml{23,44}
type: object
additionalProperties: false

required:
  - adminUser
  - database

properties:
  adminUser: { $ref: '#/definitions/AdminUser' }
  database: { $ref: '#/definitions/Postgres' }

definitions:
  AdminUser:
    type: object
    additionalProperties: false
    required: [email, password]
    properties:
      email:
        type: string
        format: email
      password:
        type: string
        secret: true
  Postgres:
    type: object
    additionalProperties: false
    required:
      - hostname
      - port
      - database
      - username
      - password
    properties:
      hostname:
        $ref: '#/definitions/Hostname'
      port:
        type: integer
      database:
        type: string
      username:
        type: string
      password:
        type: string
        secret: true
```

<h4 style="text-align:center">.app-config.toml</h4>

```toml
[adminUser]
email = "devops@example.com"

[database]
hostname = "localhost"
port = 5432
database = "my_app"
username = "admin"
```

<h4 style="text-align:center">.app-config.secrets.json</h4>

```json
{
  "adminUser": {
    "password": "S3CUR1TY!"
  },
  "database": {
    "password": "SuperSecur3"
  }
}
```

You might balance these differently. We've found putting values like usernames in secret files useful.
These files are merged together anyway, so it's up to you what should or should not be committed.
