---
title: Introduction
---

## What is App Config?

::: tip In a hurry?
Check out the [Quick Start](./quick-start.md) guide.
:::

App Config helps you manage settings for your application.

It is a Node.js library, a CLI application, and a set of standards.

App Config is suitable for Web Apps, Servers, CLI Applications, Mobile Apps and more.
App Config is written in TypeScript, but it's designed for use in other languages.
It can act as a consumer or producer of configuration values.
This is possible because of some simple standards for reading and exposing configuration.

---

Your application should be configurable, plain and simple.
Changing a database hostname, email address or an AWS key should never be code changes.
The more configurable an app is, the faster your business can move!

App Config pairs well with Docker-like environments.
You can use the same image across QA, Staging and Production.
This gives you the confidence of identical deployments, with a lot of flexibility.

You might be using a `.env` library like [dotenv](https://www.npmjs.com/package/dotenv).
This is a great first step! But it's not safe, on its own.
Environment variables lose a lot of semantic meaning - they are all plain strings!

To maintain confidence in your configuration, you want to define **validation**.
On their own, environment variables are unsafe to use without additional checks.

## Configuration

Configuration comes in the form of a JSON-like structure of values.
App Config provides an accessible way to read these values through environment variables, a Node.js API or CLI.
It defines a standard way to store these values in files, make changes to them, and share with others in version control.

We can **validate** configuration. That means checking that values and their structure are _as intended_.
Typos, missing keys, or values outside of limits should never make it to production.

Yet another config library? We thought so too, until we looked a solution for configuration at [Launchcode](https://lc.dev).
We needed an isomorphic solution to load configuration values, that strictly prevents mistakes.
We needed this for frontend, backend and mobile app projects. Using the same tool for all these was a must.
We also didn't like the trend of "opinionated" libraries, with a lot of implicit behavior.

We looked around the Node.js ecosystem for something that would fit this need.
Many of the existing tools are JavaScript heavy, making them too dynamic to provide good TypeScript support.
We also found a lot of libraries with "magic" built-in (usually not optional), with a set of strict opinions.

Some of them might fit your use case! New suggestions are welcome.

- [conf](https://www.npmjs.com/package/conf)
- [node-config-ts](https://www.npmjs.com/package/node-config-ts)
- [dotenv](https://www.npmjs.com/package/dotenv)
- [rc](https://www.npmjs.com/package/rc)
- [nconf](https://www.npmjs.com/package/nconf)
- [config](https://www.npmjs.com/package/config)
- [node-convict](https://www.npmjs.com/package/convict)
- [node-config-ts](https://www.npmjs.com/package/node-config-ts)

## Goals

We intend to provide:

- A tool that can slot in to your workflow without disruption, and be learnt in 30 minutes.
- A way to write configuration and schema files, where mistakes are a thing of the past.
- Amazing ergonomics, providing the slimmest API with deep control if you need it.
- A toolbelt for improving your configuration strategy, that's incrementally adoptable.
- Simplicity without magic - `app-config` will only do what you ask it to.
- Tie-in for non-javascript environments, which can consume environment variables safely.
- Support for your favorite file format, so you can focus on building instead of a new syntax.
- Heavy re-use of configuration files, schema definition and strategies.

## Features

- **Schema Validation:** Checks that configuration is valid according to a [JSON Schema](https://json-schema.org/).
- **Multi-Format:** Supports YAML, TOML, JSON and JSON5 for value and schema files.
- **Strong Typing:** Provides type-safe access to config values based on schema constraints.
- **Environment Specific Values:** Makes environments like QA vs Production easy to manage.
- **Value Sharing:** Easily shares values between different apps or services.
- **Value Encryption:** Allows committing secret values without worry.
- **Producer & Consumer:** Provides tools to interact with other ecosystems.
- **Extensible Parsing:** Provides built-in and plugin parsing extensions for custom behavior.

We will briefly touch on each of these below.

#### Schema Validation

App Config looks for a file called `.app-config.schema.{yml|toml|json|json5}`.
This file contains the full JSON Schema object which is used to validation config values.
You'll find more information about this file in [Schema Validation](./schema-validation.md).

#### Multi-Format

App Config will load any supported file format when loading configuration.
That includes schema and meta files as well.
We currently support YAML, JSON, TOML and JSON5.

#### Strong Typing

App Config has built-in support for generating type files that are inferred from your JSON Schema.
This support leverages a tool called [quicktype](https://quicktype.io).
Because of that, app-config comes with ways to generate code for many different languages.
Currently, we support **TypeScript**, **Go** and **Rust**.

#### Environment Specific Values

Create a `.app-config.production.{yml|toml|json|json5}` file with values to use when `NODE_ENV=production`.
Or, use the embedded helper `$env` for colocated configurations. [More here](./config-loading.md).

#### Value Sharing

With the `$extends` and `$override` keys, you can load values from shared files.
You can use this in a monorepo as a convenient way of sharing of common configuration values.
[More here](./extensions.md).

#### Value Encryption

Share secret values in source control with your team, encrypted with local private keys.
[More here](./encryption.md).

#### Producer & Consumer

Use App Config to read configuration in a Node.js app.
Or, use the CLI to read and validate config, before passing values into your app.

#### Extensible Parsing

Make App Config your own, by defining parsing extensions for custom behavior.
Learn more in [Parsing Extensions](./extensions.md#custom-extensions).

## Installing

Alright, so you want to try out `app-config`! First step is always, of course, installing it.

::: tip
You'll find more information for the environment you're targeting in the Node.js, Webpack or React Native sections.
:::

```sh
yarn add @lcdev/app-config@2
```

Or, if you use NPM.

```sh
npm i @lcdev/app-config@2
```

## Usage

We encourage you to read through the Introduction Guide before committing to App Config for your project.
You can visit the [Quick Start Guide](./quick-start.md), [Node.js Setup](../node/README.md), [Webpack Setup](../webpack/README.md),
or [React Native Setup](../react-native/README.md) for more starting instructions.

**TLDR?**
1. Start off with a `.app-config.{yml|toml|json|json5}` file.
2. Define JSON Schema in `.app-config.schema.{yml|toml|json|json5}`.
3. Load configuration using `npx @app-config/cli` or `loadConfig` Node.js API.
