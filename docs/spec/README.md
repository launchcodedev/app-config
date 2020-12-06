---
title: Specification
---

This document defines the exact instructions required to be "App Config Compliant".
What does that mean? App Config intends to be more than a library confined to the Node.js ecosystem.
So in that spirit, we're providing instructions for language bindings to follow in order to interoperate.

Does that mean we want N+1 ports of the App Config package? No, not really.
This spec defines **minimal required support**, and App Config itself will be free to provide more features.

## High Level Overview

We'll separate parts of App Config:

1. Loading App Config through files
2. Loading App Config through an environment variable
3. JSON Schema Validation
4. Parsing extensions and environment-specific features

So to be clear, **this spec will not define #1 or #4**. These are non-trivial
parts of App Config, and would be a lot to replicate truthfully in every language.

Instead, we'll try to outline #1 and #3. These may not describe _every_ feature
that the App Config library supports, but App Config should faithfully fulfil the requirements.

## Loading App Config through an environment variable

App Config is defined as an environment variable. This variable is named `APP_CONFIG`.
Libraries can support different names, but all should use `APP_CONFIG` by default.

This environment variable should be a string, containing text that can be parsed as JSON.
This JSON value should an object. Libraries should reject invalid JSON strings or non-objects, if possible.

## JSON Schema Validation

Whether the value contained in `APP_CONFIG` is valid is up to the schema.

Schemas are JSON files, with the exact name `.app-config.schema.json`.
This file should be present in the working directory, but libraries should provide an option for this.

A missing schema file should result in an error, unless the library provides a non-validation opt-out option.

Schemas should follow the exact specification of [JSON Schema](https://json-schema.org/specification.html).
Users tend to use draft releases of this spec, so libraries are encouraged to support as many versions as possible.
The exact version to use when a schema is ambiguous is up to library authors.

Non-standard JSON Schema keywords should be ignored. In particular, the "secret" key is often used.
Because library authors are only required to load environment variables, we don't require checking "secretness".

**To be liberal, a library can skip JSON Schema validation**.
We encourage authors not to do this, but we intend for this specification to be very minimal.
So if your language has no off the shelf libraries for JSON Schema, it may be unreasonable.
In these cases, we strongly encourage strict object-structure validation, at the least.
We don't want users to receive unexpected values from App Config, which is exactly what the library is meant to avoid.

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
This is especially easy in strongly typed languages, like golang, Rust or Java.

We're currently experimenting with:

- golang (using xeipuuv/gojsonschema)
- rust (using valico)

## Interoperation

We've defined a really small subset in this document. The last thing we want
is to encourage not using the features of App Config. Instead, we want App Config
to provide the tools you need for development. In production, you can "bootstrap"
configuration to be compatible with your language without the App Config library.

The intention here, is for development to look like:

```sh
npx @lcdev/app-config -s -- go run .
```

And for production to look like:

```sh
# extract configuration for the deployment environment, and expose it as an environment variable
APP_CONFIG=$(NODE_ENV=qa npx @lcdev/app-config -s create --format json)

# normalize your development schema into a JSON file, ensuring that it's present in production
npx @lcdev/app-config create-schema --format json > .app-config.schema.json
```

This is a simple example, meant to show not tell. The idea is that `@lcdev/app-config`
itself is used for creating the final values / files that your app uses. This allows
your app to use the configuration easily without having to know about complicated
parsing extensions, inter-file dependencies, etc.
