---
title: Config Loading
---

See the [intro](./README.md) for more introductory material if you haven't already.
This page will go over the exact strategy used for loading config files, environment
variables, etc.

1. Is the `APP_CONFIG` environment variable defined?
    - If yes, guess it's file format and parse it. This is the full config.
2. Find the current environment, based on `APP_CONFIG_ENV`, `NODE_ENV` or `ENV` (whichever is defined, in that order).
3. Resolve environment "aliases" (dev -> development, prod -> production).
4. Load main config file:
    1. Look for `.app-config.{currentEnvironment}.{yml|yaml|toml|json|json5}`, whichever is found first
    2. Look for `.app-config.{yml|yaml|toml|json|json5}`, whichever is found first
5. Load secrets config file (this is allowed to fail):
    1. Look for `.app-config.secrets.{currentEnvironment}.{yml|yaml|toml|json|json5}`, whichever is found first
    2. Look for `.app-config.secrets.{yml|yaml|toml|json|json5}`, whichever is found first
6. [Merge](#merging) main and secret config values recursively
7. Look for `APP_CONFIG_EXTEND` or `APP_CONFIG_CI` environment variables
    - If defined, guess the format and parse it. Then [merge](#merging) it on top of loaded configuration.


## Merging
Check `ParsedValue::merge` for the code.

Given `a` and `b`:
- If either is not an object, prefer `b`.
- Iterate over keys of both, and merge each entry recursively using the same strategy. Non-overlapping keys just chose the existing entry.
