---
title: Specification
---

## Specification

This document defines the exact instructions required to be "App Config Compliant".

What does that mean? App Config intends to be more than a library confined to the Node.js ecosystem.
So in that spirit, we're providing instructions for **other programming languages** to follow in order to interoperate.

Does that mean we want N+1 ports of the App Config package? No, not really.
This spec defines **minimal required support**, and App Config itself will be free to provide more features that are beyond that scope.

## High Level Overview

We'll separate parts of App Config:

1. Loading App Config through files
2. Loading App Config through an environment variable
3. JSON Schema Validation
4. Parsing extensions and environment-specific features

So to be clear, **this spec will not define #1 or #4**. These are non-trivial
parts of App Config, and would be a lot to replicate truthfully in every language.

Instead, we'll try to outline #2 and #3. These may not describe _every_ feature
that the App Config library supports, but App Config should faithfully fulfill the requirements.

## Loading App Config through an environment variable

App Config is defined as an environment variable. This variable is named `APP_CONFIG`.
Libraries can support different names, but all should use `APP_CONFIG` by default.

This environment variable should be a string, containing text that can be parsed as JSON.
This JSON value should an object. Libraries should reject invalid JSON strings or non-objects.

## JSON Schema Validation

Whether the value contained in `APP_CONFIG` is valid is up to the schema.

Schemas are JSON values, exposed through another environment variable named `APP_CONFIG_SCHEMA`.

A missing schema should result in an error, unless the library provides a non-validation opt-out option.

Schemas should follow the exact specification of [JSON Schema](https://json-schema.org/specification.html).
Users tend to use draft releases of this spec, so libraries are encouraged to support as many versions as possible.
The exact version to use when a schema is ambiguous is up to library authors.

Non-standard JSON Schema keywords should be ignored. In particular, the "secret" key is often used.
Because library authors are only required to load environment variables, we don't require checking "secretness".

## Library Interface

Libraries that are App Config Compliant should provide one function:

```
# In pseudo-code form:

fn load_configuration(options?) -> ConfigurationObject
```

This function can be "async", or provide different ways of calling it.
It's also common to define a global variable or singleton instance.
Options can be library-defined. You might provide options for CWD, environment variable name, no-validation, etc.

## Official Libraries

The App Config library intends to officially support as many of these libraries as we can.
Primarily, we believe that we can leverage our existing tooling to "jump start" these efforts.

In many languages, it should be possible to dynamically **generate an App Config Compliant library for you**.
This is especially easy in strongly typed languages, like Go, Rust or Java.

We're currently have built-in support for generating: **[Go](./golang.md)** and **[Rust](./rust.md)**.

File a GitHub [issue](https://github.com/launchcodedev/app-config/issues/new) if you want support in your language of choice.

## Interoperation

We've defined a really small subset in this document. The last thing we want
is to encourage not using the features of App Config. Instead, we want App Config
to provide the tools you need for development. Features like `$extends` and `$env`
are useful for developers, and can be "erased" by the time your app goes to production.
By not needing these features, language support can be simple.

The intention here, is for development to look like:

```sh
npx @app-config/cli -s -- go run .
```

And for production to look like:

```sh
# extract configuration for the deployment environment, and expose it as an environment variable
APP_CONFIG=$(NODE_ENV=qa npx @app-config/cli -s create --format json)

# normalize your development schema, ensuring that it's present in production
APP_CONFIG_SCHEMA=$(npx @app-config/cli create-schema --format json)
```

This is a simple example, meant to show not tell. The idea is that `@app-config/cli`
itself is used for creating the final values that your app uses. This allows your app
to use the configuration easily without having to know about complicated parsing
extensions, inter-file dependencies, etc.
