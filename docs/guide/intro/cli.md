---
title: Command Line Usage
---

### Command Line Usage

App Config has a pretty comprehensive CLI. The goal is to be useable by non-JavaScript
projects, where possible. As outlined in the introduction, the CLI has two primary use
cases - being a _producer_ or _consumer_ of app-config.

1. It can act as a "producer" of configuration to apps that are agnostic to `app-config`.
2. It can act as a "consumer" of configuration inside of an app, with direct knowledge of `app-config`.

```mermaid
graph LR
    files[Config Files]
    env{{APP_CONFIG}}
    schema[Schema File]
    core[App Config Core]
    api[Node.js API]
    cli[CLI]
    stdout[stdout]
    envs{{Environment Variables}}
    ext[External Programs]

    env --> core
    files --> core
    schema --> core
    core --> api
    core --> cli
    cli --> stdout
    cli --- envs --> ext

    style cli fill:#BBB,stroke:#BBB
    style api fill:#BBB,stroke:#BBB
    style core fill:#BBB,stroke:#BBB
    style env fill:#7c8bd9,stroke:#3f58d4
    style envs fill:#7c8bd9,stroke:#3f58d4
```

## Nested Commands

App Config will run child commands for you, with extra environment variables injected.

```sh
npx @app-config/cli -- env
```

This is the canonical example because it's simple to explain.
`env` is a built-in POSIX command.
Running the above command is asking app-config to run `env` with no arguments, but with
some extra environment variables injected while running.

The output will include `APP_CONFIG` and many other `APP_CONFIG_{FLATTEND_NAME}` variables.
You can run `app-config vars` to see them all on their own.

```sh
npx @app-config/cli -- docker-compose up -d
```

This is a more realistic example. You might have a `docker-compose.yml` file that uses some
environment variables (eg. `APP_CONFIG_DATABASE_PORT` to forward). This injects docker-compose
with variables that it can use.

In general, the pattern of adding NPM scripts like this is common:

```json
  "scripts": {
    ...
    "docker-compose": "app-config -- docker-compose",
    ...
  }
```

This enables a shorter version of the above, `yarn docker-compose up -d`.
Because running nested commands injects an `APP_CONFIG` variable, this is common as well:

```yaml
services:
  my-app:
    image: my-registry.com/my-app
    environment:
      - 'APP_CONFIG=${APP_CONFIG}'
```

This allows you to inject the current `APP_CONFIG` directly into a running instance of `my-app`.

## Viewing and Formatting Values

```sh
npx @app-config/cli create --format json
```

The `create` subcommand will generate a config object from loaded configuration.
Note that this command (and most others) **does not include secrets** unless you add a `-s` flag.
This is a common mistake and easy to forget.

This command also accepts a `--select='#/server'` option, using JSON Pointer syntax
to select a specific nested value inside of the config. Selecting a sub-object
can be handy for deployment, or for quick copy-pasting.

```sh
npx @app-config/cli vars
```

The variables subcommand prints out all variables that will be injected when running [nested commands](#nested-commands).
It does not include `APP_CONFIG`, which is injected in nested commands.

Both `create` and `variables` accept:

- `--secrets` to include secret values
- `--noSchema` to avoid validation
- `--select` to print a sub-object
- `--fileNameBase` to use a different filename when loading files
- `--environmentVariableName` to use a different name than `APP_CONFIG`

The `variables` subcommand can also be told to "rename" and filter variables.
These options are available for nested commands as well.

```sh
npx @app-config/cli vars --only APP_CONFIG_DATABASE_PASSWORD --only APP_CONFIG_DATABASE_USER
npx @app-config/cli vars --rename APP_CONFIG_DATABASE_PASSWORD=POSTGRES_PASSWORD --only POSTGRES_PASSWORD
```

This is handy for using App Config as an entrance point for other programs.

```sh
npx @app-config/cli create-schema
```

The create-schema subcommand provides a way to write a fully resolved schema, with all of its `$ref` file references inline.
This can be useful for deployments, so that you don't need to include multiple schema files in production.

## Code Generation

```sh
npx @app-config/cli generate
```

The generate command reads the meta file, and does all [code / types generation](./codegen.md).
Code generation is driven by options in the meta file.

## Encryption Commands

```sh
npx @app-config/cli secret init
```

Initializes your encryption keychain on your machine. These are stored in a shared directory.

```sh
npx @app-config/cli secret init-repo
```

Creates a new symmetric key and initializes team members for a repository.
By default, you are the only trusted team member.

```sh
npx @app-config/cli secret init-key
```

Creates a new symmetric key for encrypting new secrets. This is usually not required,
since it's automatically done when untrusting team members.

```sh
npx @app-config/cli secret key
npx @app-config/cli secret export <path>
```

View or export your public key to a file. This is used to share your public key with
others so that they can trust you. See more in [encryption](./encryption.md#trusting-users).

```sh
npx @app-config/cli secret ci
```

Creates an encryption key that can be used without a passphrase. This is useful for
providing CI access to encrypted values, as the name suggests.

```sh
npx @app-config/cli secret trust <keyPath>
```

Adds a team member who can encrypt and decrypt values. See more in [encryption](./encryption.md#trusting-users).

```sh
npx @app-config/cli secret untrust <email>
```

Revokes encryption access (in the future) for a trusted team member.

```sh
npx @app-config/cli secret encrypt
```

Encrypts a secret value. Reads from stdin, or provide an extra argument with the value.

```sh
npx @app-config/cli secret decrypt
```

Decrypts a secret value. Reads from stdin, or provide an extra argument with the value.

```sh
npx @app-config/cli secret agent
```

Starts the background decryption process to avoid passphrase prompts. This process
is not automatically daemonized - you'll need to run it in a separate tab.

```sh
npx @app-config/cli secret reset
```

Removes your encryption keychain. You will lose access to all repositories that
trusted you before.

## Logging

All commands have `--verbose`, `--quiet` and `--silent` options. You can also set
an environment variable called `APP_CONFIG_LOG_LEVEL` to "verbose", "info", "warn" or "error".
