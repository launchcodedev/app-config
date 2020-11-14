---
title: Introduction
---

Welcome! Do you build web apps? Node.js servers? CLI applications? Tired of writing logic to parse JSON files?
Made a typo while deploying, causing runtime errors? Maintaining a `config.ts` with commented-out values?
**We built app-config for you.**

Yet another config library? We thought so too, until we needed a solution for configuration at [Launchcode](https://lc.dev).
The ask was fairly simple - an isomorphic solution to load configuration values, that strictly prevents mistakes.
We needed this for frontend, backend and mobile projects. Using the same tool for all of these was a must.

In a hurry? See [Quick Start](./quick-start.md).

## Beginning

To start with, what is "configuration"?

1. A nesting structure of values, generally JSON-like (objects, arrays, strings, numbers and booleans).
2. An accessible way to read these values programmatically.
3. A way to store these values (files), mutate them, and share them (to others, and in deployments).

On top of this, we want to **validate** this configuration. That means ensuring
the values and their structure is _as intended_. Typos, malformatting, or values
outside of limits should never make it to production.

We looked around the Node.js ecosystem for something that would fit these goals.
Unfortunately, much of the existing tools are javascript-heavy, meaning they're too
dynamic to provide good TypeScript support. We also found a lot of libraries with
"magic" built-in (usually not optional), with a set of hard opinions.

You might be interested by some of them - they might fit your use case better!

- [conf](https://www.npmjs.com/package/conf)
- [node-config-ts](https://www.npmjs.com/package/node-config-ts)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [rc](https://www.npmjs.com/package/rc)
- [nconf](https://www.npmjs.com/package/nconf)
- [config](https://www.npmjs.com/package/config)
- [node-convict](https://www.npmjs.com/package/convict)

## Goals

We intend to provide:

- A tool that can slot in to your workflow without disruption, and be learnt in 30 minutes.
- A way to write configuration and schema files, where mistakes are a thing of the past.
- Amazing developer ergonomics, providing the slimmest API with deep control if you need it.
- A toolbelt for improving your configuration story, that's incrementally adoptable.
- Simplicity without magic - `app-config` will only do what you ask it to.
- Tie-in for non-javascript environments, which can consume environment variables safely.
- Support for your favorite file format, so you can focus on building instead of a new syntax.
- Heavy re-use of configuration files, schema definition and strategies.

## Installing and Getting Started

Alright, so you want to use `app-config`. First step is always, of course, installing it.

::: tip
You'll probably find more detailed information for the environment you're targetting in the Node.js, Webpack or React Native sections.
:::

```sh
yarn add @lcdev/app-config@2
```

Or, if you use NPM.

```sh
npm i @lcdev/app-config@2
```

Now, usually the first thing you want to do with configuration is read it from your application.
Before you can do that though, you'll need to tell `app-config` what to expect in your configuation values.

To do that, let's write our first [JSON Schema](https://json-schema.org/) file.

<h4 style="text-align:center">.app-config.schema.yml</h4>

```yaml
type: object
additionalProperties: false

required:
  - server
  - database

properties:
  server: { $ref: '#/definitions/Server' }
  database: { $ref: '#/definitions/Database' }

  # Notice that AWS config is optional
  aws:
    type: object

definitions:
  Server:
    type: object
    additionalProperties: false
    required: [port]
    properties:
      port: { $ref: '#/definitions/IpPort' }
  Database:
    type: object
    additionalProperties: false
    required: [host, port]
    properties:
      host: { type: string }
      port: { $ref: '#/definitions/IpPort' }
      database: { type: string }
  IpPort:
    type: integer
    minimum: 0
    maximum: 65535
```

Notice that we wrote some YAML above, even though we said it was JSON Schema.
This is absolutely normal and expected when using app-config. You can use whatever
format you're comfortable with (YAML, TOML, JSON, JSON5).

You might be very familiar with JSON Schema, or not at all. We can't write a full
tutorial here, but there is more information about this process in [Schema Validation](./schema-validation.md).
The official site does have a [tutorial](https://json-schema.org/understanding-json-schema/)
available as well. Even if you don't end up using app-config, it's a great skill to have!

Okay, next step now. Let's try just running app-config with the schema so far.

```sh
npx app-config vars
```

You should receive an error, something like this:

```
NotFoundError: FlexibleFileSource could not find file with .app-config.{yml|yaml|toml|json|json5}
```

Alright, so it looks like `app-config` is trying to read a file called `.app-config.yml`.
That's true, but let's take a little detour.

## The `APP_CONFIG` Environment Variable

There's something you should know right away before worrying about configuration files.
You might be used to "dotenv", which is a pseudo-standard way that many applications are configured.
Typically, this involves setting environment variables and having the program consume configuration
that way. The [12 Factor App](https://12factor.net/) popularized this.

This strategy fits in `app-config` in two ways, actually.

1. It can act as a "producer" of configuration to apps that are agnostic to `app-config`.
2. It can act as a "consumer" of configuration inside of an app, with direct knowledge of `app-config`.

These two ways interact mainly through `$APP_CONFIG`. That is, there is an environment variable which
`app-config` can either produce or consume. It goes a bit further when acting as a producer as well,
setting many variables with each sub-value (eg. `APP_CONFIG_DATABASE_PORT`).

Let's experiment a tiny bit.

```sh
export APP_CONFIG='{}'

npx app-config vars
```

Now, you should see something more interesting!

```
[ValidationError: Config is invalid: config should have required property 'server', config should have required property 'database']
```

It fails again, but in a fairly different way. This time, we're seeing our schema work for us.
Of course, this is all a contrived example, but we really do urge you to try it out yourself.
Play with the schema, and set the `APP_CONFIG` variable accordingly.

```sh
export APP_CONFIG='{ server: { port: 8800 }, database: { host: localhost, port: 5432 } }'
```

This time, you should see something different!

```sh
$ npx app-config vars
APP_CONFIG_SERVER_PORT=8800
APP_CONFIG_DATABASE_HOST="localhost"
APP_CONFIG_DATABASE_PORT=5432

$ npx app-config create -f yaml
server:
  port: 8800
database:
  host: localhost
  port: 5432
```

If everything is working correctly, you should see the same output. We've passed
the configuration to `app-config` via environment variable, which was able to read
and parse it. Notably, we wrote it with [JSON5](https://json5.org/) syntax. The format
of the environment variable in unimportant - it could have been YAML, TOML, or JSON (you
might choose something with strict syntax like JSON, but normally this variable is generated
programmatically anyways).

## The `.app-config` File

Alright, back to our original problem. Environment variables are great, but you'd
have a terrible time maintaining a big JSON plain like that (which is where tools
like dotenv originated).

<h4 style="text-align:center">.app-config.yml</h4>

```yaml
server:
  port: 8888

database:
  host: central-server
  port: 5432
```

Again, our choice of YAML here is unimportant.

We can run our `app-config` again, and should see our values.

```sh{3,5}
$ npx app-config create -f yaml
server:
  port: 8800
database:
  host: localhost
  port: 5432
```

Funny enough, we don't! At least, if you've been following this page linearly.
Earlier, we set the `$APP_CONFIG` environment variable. Well, it turns out that
when given the choice, `app-config` will chose that variable (which makes production
environments easy to configure, allowing them to override files entirely).

```
$ unset APP_CONFIG
$ npx app-config create -f yaml
server:
  port: 8888
database:
  host: central-server
  port: 5432
```

Now we see our configuration file take effect.

## Environment Specific Files

Note that `.app-config.yml` is not our only option. You may want a completely different
set of values for production. You could use `$env`, as [you'll see](./extensions.md).
You can also, however, make environment specific files.

By defining a file called `.app-config.production.yml`, app-config will load it only
when `APP_CONFIG_ENV` | `NODE_ENV` | `ENV` is `prod` or `production` (see [defaultAliases](../node/api-reference.md)).
