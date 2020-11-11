---
title: Schema Validation
---

Your configuration is nothing if you can't constrain it. Runtime errors can
happen any time, causing anywhere from small to catastrophic damage. Remember
that most of the time, configuration values are only read in some execution
pathways, so it may be days before you notice a problem.

The core feature of app-config is the way it validates configuration values.

We've noticed that (especially in the Node.js ecosystem) many packages define
their [own](https://github.com/jquense/yup) [validation](https://joi.dev/)
[mechanism](https://gcanti.github.io/io-ts/). This is [overwhelming](https://github.com/typestack/class-validator)
and a [lot](https://github.com/pelotom/runtypes) to [learn](https://express-validator.github.io/docs/).

Instead, we chose [JSON Schema](https://json-schema.org/). It's well supported in many
languages, it's used in a lot of popular tools (eg. OpenAPI), and simple to read.
While a little bit verbose (less in YAML than JSON), it's comprehensive and easy to
find resources for. You might already know JSON Schema well.

## JSON Schema Basics

We can't document everything about JSON Schema here. You're best off to learn from
[existing resources](https://json-schema.org/understanding-json-schema/reference/index.html).

We will outline a couple basic techniques here though, with examples. Note that app-config
supports the latest JSON Schema standard, which is currently draft 7.

As a reminder, app-config reads schemas from the `.app-config.schema.{ext}` file.

<h4 style="text-align:center">.app-config.schema.yml</h4>

```yaml
type: object
additionalProperties: false

required:
  - server

properties:
  server:
    type: object
    additionalProperties: false
    required: [port]
    properties:
      port: { $ref: '#/definitions/IpPort' }

definitions:
  IpPort:
    type: integer
    minimum: 0
    maximum: 65535
```

This is a simplified version of the intro schema. It defines configuration
values for a web server of some kind. There are a few things and conventions
that are worth explaining.

```yaml{6}
server:
  type: object
  additionalProperties: false
  required: [port]
  properties:
    port: { $ref: '#/definitions/IpPort' }
```

Zooming in on the `.server.port` property - we see a `$ref` key. This is a
special property that allows re-use of schema types. It even supports cross-file
references. It uses [JSON Pointer](https://json-schema.org/understanding-json-schema/structuring.html)
syntax.

```yaml{6}
server:
  type: object
  additionalProperties: false
  required: [port]
  properties:
    port: { $ref: '../.app-config.schema.yml#/definitions/IpPort' }
```

Here's an example of a common pattern. By specifying a filepath before `#`,
we're asking app-config to pull in another file so that we can reference
a property within it. In monorepos with shared types, this is very handy.

## Marking Secret Properties

App Config has a simple extension to JSON Schema, that's used for "secrets".
Properties can be marked with a boolean property `secret` like so:

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

This property tells app-config that it should never see `password` in a non-secret
file. See the [Secret Values](./secrets.md) page for more about secret files.
Note that encrypted values are allowed in non-secret files. Note also that the
`APP_CONFIG` variable is essentially treated as secret, so it will not trigger
schema validation errors.

## Avoiding Validation

Sometimes, you want to prototype without building out a schema. That's okay!
We provide a couple ways to load configuration without validation.

1. The CLI has a `--noSchema` option for most subcommands.
2. The Node.js API has a `loadUnvalidatedConfig` function - `loadConfig` always validates.

It's worth noting, that JSON Schema can be fairly liberal if you need it to be.
`{ "type": "object" }` essentially allows any configuration.
