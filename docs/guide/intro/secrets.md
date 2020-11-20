---
title: Secret Values
---

Configuration can include sensitive values of all kinds. A private key, a
3rd-party API token, a database password, etc. Anything that should not be
committed in git is a "secret".

App Config has two ways to think about and deal with secrets. **Secret files**
and [encrypted values](./encryption.md).

The simpler of the two is secret files. These are exactly the same as configuration
files, they just get stored in a different file, `.app-config.secrets.{ext}`. The filepath is the
only difference, from the perspective of app-config. The values are [treated different
during validation though](./schema-validation.md#marking-secret-properties).

The difference for you as a user is in version control. These files should always
be ignored so they are never committed. The following ignore pattern is liberal,
but probably what you want to use as a convention anyways.

<h4 style="text-align:center">.gitignore</h4>

```
*.secrets.*
```

<br />

A few notes about secret files:

- Values in secret files are merged (deeply) with main config files. Secrets take precedent.
- Values that are read from secret files are allowed with schema `secret: true` properties.
- Secret files are not loaded when `APP_CONFIG` environment variable is read.

You may never need secret files if you're using [encryption](./encryption.md) for all values.
Otherwise, they're a handy way to split up configuration. "Secret" vs "Not Secret" tends to be
a good boundary for values either way.
