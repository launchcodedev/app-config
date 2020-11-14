---
title: Secret Values
---

Configuration can include sensitive values of all kinds. A private key, a
3rd-party API token, a database password, etc. Anything that should not be
committed in git is a "secret".

App Config has two ways to think about and deal with secrets. **Secret files**
and [encrypted values](./encryption.md).

The simpler of the two is secret files. These are the same as configuration
files, they just get stored in `.app-config.secrets.{ext}`. The filepath is the
only difference, from the perspective of app-config.

The difference for you, however, is in version control. These files should be ignored
so that they are never committed.

<h4 style="text-align:center">.gitignore</h4>

```
*.secrets.*
```

A few notes about secret files:

- Values in secret files do get merged with main config files. Secrets take precedent.
- Values that are read from secret files are allowed with schema `secret: true` properties.
- Secret files are not loaded when `APP_CONFIG` environment variable is read.
