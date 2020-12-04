---
title: Deployment
---

Below are tips & tricks for deploying an application that uses App Config.

## Always ship schema file(s)

In order to do validation, App Config needs JSON Schema. Don't forget to deploy this file!

## Use create-schema to resolve schema into one file

To make following the tip above easier, "resolve" your schema at build time using the `create-schema` CLI subcommand.
This will inline all schema references into one file, which is easier to `ADD` in docker (or whatever platform you choose).

## Serialize APP_CONFIG variable using CLI

When deploying, you'll want to use the `APP_CONFIG` environment variable.
Generate a "frozen" value using the CLI, for the environment you're deploying to.

```sh
NODE_ENV=production npx app-config create --format json --secrets
```

## Use app-config-inject for frontends

Create a re-useable deployment container by using [app-config-inject](../webpack/inject.md).
Makes it easy to share the same code between environments.
