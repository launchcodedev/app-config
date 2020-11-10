## Version 2 (v2.0.0)

[🎁 Features](#features-v2-0-0) [🔨 Breaking Changes](#breaking-changes-v2-0-0)

This new major version is effectively a rewrite, with some powerful constructs
being added internally. Much of this is does not change the external semantics
of the package, but internally it makes a huge difference.

The selling point for this upgrade is secret encryption. This means that a
built-in solution for storing your secrets in a safe, encrypted form.

Previous to v2, secrets were a complimentary feature. This meant it was left to
the user how and where secret values were stored.

In general, it's nice to store configuration in version control if possible.
This is, of course, impractical for values that should never be public. Having
these secrets in plaintext is just asking for trouble.

Solutions have come out to do this - [git-secret](https://git-secret.io/),
[git-crypt](https://www.agwa.name/projects/git-crypt/) and
[blackbox](https://github.com/StackExchange/blackbox) to name a few.
We have built a similar solution, but highly integrated. At Launchcode, we
tried these solutions, but felt that they were clunky to use for users who
weren't very familiar with GPG.

So, we set course on designing an interface that combined the security of
these tools with the ergonomics that developers expect. There were many dead
ends, actually. It became increasing obvious that such a feature could not
be easily added to app-config without a fairly major change in architecture.

#### Breaking Changes (v2.0.0)

- The `{function}Sync` function interfaces have been removed. Almost all functions are async-only.
- We no longer look for `app-config.{ext}` files - only **`.app-config.{ext}`** is loaded by default.
- The default export of the function is not available prior to `loadConfig` being called.
  Essentially, you'll need to add a call to `loadConfig` in your program's entrypoint.
  Note that TypeScript can't help you here, since the `config` object has a non-optional type.
  Also note that **webpack** projects do not need to make any changes, since the async portion is done at build time.

```typescript
import config, { loadConfig } from '@lcdev/app-config';

async function main() {
  await loadConfig();

  // after loadConfig is resolved (not just called!), `config` is accessible
  console.log(config);
}
```

- The Node.js API has quite a few breaking changes. These should all be apparent in the TypeScript types.
  Unfortunately, this has the effect of making compatible tools difficult (eg. webpack plugin).
  We intend to ship a compatibility layer in v1, so that tools can rely on the v2 API without worry.
- The environment variable name algorithm (used to flatten your config into `APP_CONFIG_FOO_BAR`) is a bit different.
  The obvious change is with numbers in variable names - `address1` now gets transformed to `ADDRESS_1` instead of `ADDDRESS1`.
- Environment variable substitution (eg. `port: '${PORT:-3000}'`) does not happen automatically anymore. Use the `$substitute` directive instead.
- The config sub-object code generation has been removed. (eg. generating a JSON file in meta properties) To our knowledge, nobody used this.
- Schema loading no longer supports the `app-config` special property, and does not use `$extends` directive by default - use `$ref`s instead.
- There are some very subtle differences in the merging algorithm used when loading files
  (relevant if you have secret files that override non-secret files).
  Differences here are likely to be bugs though!
- The CLI interface is subtly different, but almost entirely compatible.
- The `app-config init` subcommand was removed. We don't want to build a scaffolding tool.
- Some internal packages have been upgraded. Notably, we use an internal package of [quicktype](https://quicktype.io/)
  which doesn't make stability guarantees.
- Error messages have been overhauled. Relying on them is brittle though.

#### Features (v2.0.0)

- Secret values can now be encrypted and placed in `.app-config.{ext}` files!
  Check out the [encryption guide](/guide/intro/encryption/).
- Instead of using a root-level `app-config` value, you can now use `$extends` and `$override` anywhere in the tree of configuration.
  Check out the [parsing extensions guide](/guide/intro/extensions/).
  Note that a compatibility layer is in place for `app-config` values, which may be removed in the future.
- A simple logger has been added internally. The `setLogLevel` function is exported. You can set `APP_CONFIG_LOG_LEVEL` as well.
- You can now define your own parsing extensions. This is an advanced feature, but available if you want to do powerful value transformations.
- Primitives are available for creating your own config loading strategy. You can mix-and-match parsing, file sources, environment variables, etc.
  Check out the [Node.js API guide](/guide/node/api-reference/) for more.