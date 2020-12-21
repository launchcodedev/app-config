---
title: Deployment
---

Below are tips & tricks for deploying an application that uses App Config.

## Serialize APP_CONFIG_SCHEMA variable using CLI

To make deployment easier, "resolve" your schema at build time using the `create-schema` CLI subcommand.
This will inline all schema references into one file, which is easy to set as the `APP_CONFIG_SCHEMA` variable.

```sh
APP_CONFIG_SCHEMA=$(npx app-config create-schema --format json)
```

One option is to pass this into a Dockerfile as a build argument and use `ENV`.
Or in non-docker environments, `export` it before deploying/running the application.

## Serialize APP_CONFIG variable using CLI

When deploying, you'll want to use the `APP_CONFIG` environment variable.
Generate a "frozen" value using the CLI, for the environment you're deploying to.
This simplifies all of the values in config, and enables [spec compliant](../../spec/README.md) apps to work.

```sh
APP_CONFIG=$(NODE_ENV=production npx app-config create --format json --secrets)
```

Configuration should be dynamic, so you should set this variable when deploying.

## Use app-config-inject for frontends

Create a re-useable deployment container by using [app-config-inject](../webpack/inject.md).
This makes it easy to share the same code between environments, even for statically built web apps.
