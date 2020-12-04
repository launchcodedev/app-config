---
title: Schema Validation
---

## Why JSON Schema?

Your configuration is dangerous if you can't constrain it.
Runtime errors could happen any time, causing anywhere from small to catastrophic damage.
Remember that most of the time, configuration is only used in some execution pathways.
It may be days before you notice a problem (or worse, you never do).

The most important feature of App Config is its **validation** of these config values.

We've noticed that (especially in the Node.js ecosystem) many packages define
their [own](https://github.com/jquense/yup) [validation](https://joi.dev/)
[mechanism](https://gcanti.github.io/io-ts/). This is [overwhelming](https://github.com/typestack/class-validator)
and a [lot](https://github.com/pelotom/runtypes) to [learn](https://express-validator.github.io/docs/).

Instead, we chose [JSON Schema](https://json-schema.org/).
It's extremely popular and well supported in many languages.
It's used in a lot of popular tools (ie. OpenAPI), and simple to understand.
While it can be a little verbose (less so in YAML), it's comprehensive and easy to find resources for.

## The Schema File

App Config uses one singular schema file when running.
This file is located in `.app-config.schema.{yml|toml|json|json5}`.
Again, it's entirely up to you what format to use.

Note that App Config will expect the schema file to exist in your current working directory.
The CLI and Node.js API both have options to override the directory, if you need to.
In the CLI, specify `-C ./my-dir`. In Node.js, pass `{ directory: './my-dir' }` when calling `loadConfig`.

The schema file should be a normal JSON Schema object.
We do allow you to omit `$schema` and `$id` if you want to - we choose reasonable defaults for you.

Before diving in, we'll take a look at a typical schema file:

<h4 style="text-align:center">.app-config.schema.json</h4>

```json
{
  "type": "object",
  "additionalProperties": false,
  "required": ["server"],
  "properties": {
    "server": {
      "description": "Properties of our HTTP server",
      "type": "object",
      "additionalProperties": false,
      "required": ["port"],
      "properties": {
        "port": {
          "description": "Port that our HTTP server will listen on",
          "$ref": "#/definitions/IpPort"
        }
      }
    }
  },
  "definitions": {
    "IpPort": {
      "type": "integer",
      "minimum": 0,
      "maximum": 65535
    }
  }
}
```

We chose JSON here, but could use TOML:

<h4 style="text-align:center">.app-config.schema.toml</h4>

```toml
type = 'object'
additionalProperties = false
required = ['server']

[properties.server]
description = 'Properties of our HTTP server'
type = 'object'
additionalProperties = false
required = ['port']

[properties.server.properties.port]
description = 'Port that our HTTP server will listen on'
"$ref" = '#/definitions/IpPort'

[definitions.IpPort]
type = 'integer'
minimum = 0
maximum = 65535
```

The two examples are exactly the same, from App Config's point of view.

## JSON Schema Basics

We can't really document JSON Schema here. You're best off to learn from
[existing resources](https://json-schema.org/understanding-json-schema/reference/index.html).

We will outline a couple basic techniques here though, with examples.
Note that App Config supports the latest JSON Schema standard, which is currently draft 7.

## Common Definitions

You might have noticed above that we have a section called "definitions".
This is sort of a special keyword, which is used to share common types.
You can think of it like a dictionary of type definitions, to be used anywhere.

The first thing to understand about JSON Schema is that it's a "recursive" type of language.
You're meant to embed types within each other, nesting upwards.
So when we specify an object like:

```yaml
type: object
additionalProperties: false
required: [server]
properties:
  server:
    description: Properties of our HTTP server
    type: object
    # ... other properties omitted
```

We're telling App Config that:

1. The root config value should be an object
2. It has an required property, called "server"
3. That property's value should be an object

Which in effect, means our config file should look like this:

```json5
{
  server: {
    port: 3000,
  },
}
```

So coming back to "definitions", this enables us to re-use those recursive types.
Our use case is really simple (just a single property without nesting), but this is a powerful tool.
Let's look at a more complicated example:

<h4 style="text-align:center">.app-config.schema.yaml</h4>

```yaml
type: object
additionalProperties: false
required:
  - database
  - fallbackDatabase
  - thirdPartyAPI
  - adminUser

properties:
  database:
    $ref: '#/definitions/Postgres'

  fallbackDatabase:
    $ref: '#/definitions/Postgres'

  thirdPartyAPI:
    type: object
    additionalProperties: false
    required: [hostname, apiKey]
    properties:
      hostname:
        $ref: '#/definitions/Hostname'
      apiKey:
        type: string
        secret: true

  adminUser:
    $ref: '#/definitions/AdminUser'

definitions:
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
        $ref: '#/definitions/IpPort'
      database:
        type: string
      username:
        type: string
      password:
        type: string
        secret: true

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

  Hostname:
    type: string
    format: hostname

  IpPort:
    type: integer
    minimum: 0
    maximum: 65535
```

There's a lot going on here. We haven't really explained the `$ref` part yet though.

## Type References

Take a look at the `.database` property - we see a `$ref` key.
This is a JSON Schema keyword that allows re-use of schema types.
It uses [JSON Pointer](https://json-schema.org/understanding-json-schema/structuring.html) syntax.

App Config supports in-file `$ref` properties, as well as cross-file references.
An example:

```yaml{7}
server:
  type: object
  additionalProperties: false
  required: [port]
  properties:
    port:
      $ref: '../all-schemas.yml#/definitions/IpPort'
```

By specifying a filepath before `#`, we're asking App Config to pull in another file so that we can reference a property within it.
In large monorepos with shared types, this is very handy.

References to arbitrary URLs [are not supported yet](https://github.com/launchcodedev/app-config/issues/23).

## Secret Properties

In the example above, we added `secret: true` to a few properties like passwords.

This isn't a standard JSON Schema property.
App Config adds a simple extension to JSON Schema that's used for secret values.
As you've seen, properties are marked with a property `secret` like so:

```yaml{9}
Database:
  type: object
  additionalProperties: false
  required: [hostname, port, username, password]
  properties:
    hostname: { type: string }
    port: { type: integer }
    username: { type: string }
    password: { type: string, secret: true }
```

This property tells App Config that it should never see `password` as non-secret.
App Config **will throw validation errors** if it does notice this guarantee violated.
This should prevent you from accidentally committing plaintext secrets.

The rules for this are:

- Values read from the `APP_CONFIG` variable are treated as secret
- Values that are read in [secret files](./secrets.md) are treated as secret
- Values that are [decrypted](./encryption.md) are treated as secret
- Values that are read from non-secret files (ie. `.app-config.toml`) are **not** treated as secret

It might seem like most values are secret, but in the majority of applications, your config will mostly live in `.app-config.{ext}` files (non-secret).

## Avoiding Validation

Sometimes, you want to prototype without building out a schema. That's okay!
We provide a couple ways to load configuration without validation.

1. The CLI has a `--noSchema` option for most subcommands.
2. The Node.js API has a `loadUnvalidatedConfig` function. `loadConfig` will always validate.

It's worth noting that JSON Schema can be fairly liberal if you need it to be.
To allow essentially any configuration values, just use `{ "type": "object" }`
as the schema.

## Schemas for Type Generation

We won't dive into it here, but you should know that App Config can [generate types](./codegen.md).
TypeScript is the only officially supported language at the moment.

To get the best experience with this system, you'll want to constrain as much as possible.
Without `additionalProperties`, for example, the TypeScript types will be far too liberal to provide safety.

The type generation will make its best attempt to keep metadata as well, like `description` (this is treated as the doc comment for properties).
You can play around with the [quicktype playground](https://app.quicktype.io) to see what works best for you.
