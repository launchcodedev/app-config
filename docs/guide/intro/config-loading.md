---
title: Loading Configuration
---

## App Config Files

The main way that users interact with App Config is `.app-config.{ext}` files.
These are strongly tied to their corresponding schema file (`.app-config.schema.{ext}`).

Let's use a simple schema for reference:

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

Defining a schema is all well and good, but you're more concerned with the actual values.

Let's try just running app-config with the schema so far.

```sh
npx app-config vars
```

You should receive an error, something like this:

```
NotFoundError: FlexibleFileSource could not find file with .app-config.{yml|yaml|toml|json|json5}
```

App Config is trying to search for an `.app-config.{ext}` file.
This is the default path that's searched.

<h4 style="text-align:center">.app-config.toml</h4>

```toml
[server]
port = 8888

[database]
host = "central-server"
port = 5432
```

We created a file called `.app-config.toml`. Our choice of TOML here is completely unimportant.

We'll try running again.

```sh
$ npx app-config vars
APP_CONFIG_SERVER_PORT=8888
APP_CONFIG_DATABASE_HOST="central-server"
APP_CONFIG_DATABASE_PORT=5432

$ npx app-config create -f json5
{
  server: {
    port: 8888,
  },
  database: {
    host: 'central-server',
    port: 5432,
  },
}
```

We can check to make sure the schema will catch errors as well.
Let's change the config values a bit:

```toml
[server]
port = 8888

[database]
host = true
port = 5432
```


```sh
$ npx app-config vars
# ... output omitted
[ValidationError: Config is invalid: config.database.host should be string]
```

## Environment Specific Files

App Config has two built-in ways to deal with environment specific values.

1. Files can be named `.app-config.{env}.{ext}`, these take precedent and are not merged.
2. Inside of `.app-config.{ext}` files, properties can use a special `$env` key.

The `.app-config.production.yml` file is entirely separated from development values.
App Config will only load values from the file corresponding to the current environment.
The same is true for `.app-config.secrets.{env}.{ext}` files as well.

Environments are defined by `APP_CONFIG_ENV`, `NODE_ENV` or `ENV` (in that order, whichever is defined).
It's entirely valid for no environment to be defined.
Errors will be thrown if no corresponding files / values can be found for the current environment.
Note that `.app-config.{ext}` is the fallback, if the file exists.

Environments can be aliased as well. `.app-config.dev.{ext}` is equivalent to `.app-config.development.{ext}`
for example. `dev=development` and `prod=production` are the only predefined aliases, but this can be customized.

A common pattern is to use merging, for the best of both worlds.

<h4 style="text-align:center">.app-config.toml</h4>

```toml
# this file has all "default" values

[server]
port = 8888

[database]
host = "central-server"
port = 5432
```

<h4 style="text-align:center">.app-config.production.json5</h4>

```json5
{
  // since we merge the default values in
  // we only need to override environment-specific values
  $extends: '.app-config.toml',
  server: {
    port: 80
  }
}
```

Because of the deep merging algorithm, this tends to work fairly well.

## Environment Specific Values

If you have shared configuration between environments, you might prefer a second option.

```yaml
server:
  port:
    $env:
      default: 3000
      production: 80
```

In any App Config file, this structure is flattened at load time.

```sh
$ NODE_ENV=production npx app-config v
APP_CONFIG_DATABASE_HOST="central-server"
APP_CONFIG_DATABASE_PORT=5432
APP_CONFIG_SERVER_PORT=80

$ NODE_ENV=qa npx app-config v
APP_CONFIG_DATABASE_HOST="central-server"
APP_CONFIG_DATABASE_PORT=5432
APP_CONFIG_SERVER_PORT=3000
```

This functionality is implemented entirely as a [parsing extension](./extensions.md).
It can be used in secret files as well.

## Environment Variables (`APP_CONFIG`)

Above all else, App Config will look for an environment variable called `APP_CONFIG`.
This is basically the first check done. Day-to-day, you likely won't use this for development.
But, for deployment of applications, this is generally the best way to use App Config.

The value of this variable should be a parseable string, containing the full config object.
Strictly speaking, `APP_CONFIG` can be in any supported file format.
From a standards perspective, we want this variable to be valid JSON - there are a lot less ambiguities and it's easier to support in other languages.

So what's the deal? Why deploy using a single variable like this?

Basically, it's extremely flexible to use environment variables as configuration.
That's why tools like `.env` are popular - it's practically the only way to configure a docker container, for example.
You can (and do try!) mount volumes with config files, and use app-config that way.
But we feel that it's better to use `APP_CONFIG`.

```sh
docker run \
  -e APP_CONFIG=$(NODE_ENV=production npx app-config create -s --format json) \
  my-app
```

This example is a bit contrived, but you probably get the idea here.
It's typical to "serialize" configuration at deploy time.
That way, there's not multiple files to read - just the one variable.

Along these lines, the App Config CLI provides `APP_CONFIG` when running nested commands.
This is easy to demonstrate by "calling itself".

```sh
$ npx app-config -- ./node_modules/.bin/app-config c --verbose
[app-config][VERBOSE] Trying to read APP_CONFIG for configuration
[app-config][VERBOSE] EnvironmentSource guessed that APP_CONFIG is JSON FileType
```

Most hosting platforms provide some way to inject environment variables into running apps at deploy time.
Running `app-config create` is an easy way to "spit out" the full configuration, suited for the deployment environment.

## Continuous Integration and Extension

Either `APP_CONFIG_CI` or `APP_CONFIG_EXTEND` can be set in an environment variable to change specific values.
These variables are parsed just like `APP_CONFIG` (they can be JSON, YAML, etc).
They are merged deeply and override any values that they define.

```sh
$ APP_CONFIG_EXTEND='{database:{host:"mock-server"}}' npx app-config v -s
APP_CONFIG_DATABASE_HOST="mock-server"
APP_CONFIG_DATABASE_PORT=5432
APP_CONFIG_SERVER_PORT=3000
```

This is, of course, most useful for CI. Your jobs could define value overrides for testing or deployment.

## Loading Strategy

When loading configuration, App Config performs the following:

1. Is the `APP_CONFIG` environment variable defined?
    - If yes, guess it's file format (by trying to parse it) and use the parsed object
    - If `defaultValues` were passed into `loadConfig`, [merge](#merging-algorithm) them
    - This is the full config. Files are not read
2. Resolve the current environment, based on `APP_CONFIG_ENV`, `NODE_ENV` or `ENV`
    - Resolve environment aliases (dev -> development, prod -> production)
3. Load main config file:
    1. Look for `.app-config.{env}.{yml|yaml|toml|json|json5}`, whichever is found first
    2. Look for `.app-config.{yml|yaml|toml|json|json5}`, whichever is found first
4. Load secrets config file (this is allowed not to exist):
    1. Look for `.app-config.secrets.{env}.{yml|yaml|toml|json|json5}`, whichever is found first
    2. Look for `.app-config.secrets.{yml|yaml|toml|json|json5}`, whichever is found first
5. [Merge](#merging-algorithm) the _main_ and _secret_ config values as the _full_ config
6. If `defaultValues` were passed into `loadConfig`, [merge](#merging-algorithm) them
7. Look for `APP_CONFIG_EXTEND` or `APP_CONFIG_CI` environment variables
    - If defined, guess the format and parse it.
    - [Merge](#merging-algorithm) this value *on top* of loaded configuration

## Merging Algorithm

Given `a` and `b`:
- If either `a` or `b` is not an object (arrays not included), prefer `b`.
- Iterate over keys of both, and merge each entry recursively using the same strategy.
  - Non-overlapping keys chose the existing entry.

## Customizing

We aim to make almost everything about config loading customizable.
This should be true of the CLI and Node.js API.
