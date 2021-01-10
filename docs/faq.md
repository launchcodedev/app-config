---
title: Frequently Asked Questions
---

## Frequently Asked Questions

**I'm getting "SecretsRequireTTY" errors in CI.**

::: details Answer
This error occurs when App Config is trying to decrypt secrets. To do so,
it needs to unlock the repository's private keys. If the global keychain
has a passphrase, this cannot be done without prompting the user for a
passphrase on stdin.

In environments in CI, there's no TTY, and therefore, we can't prompt the user!

You likely want to create a passphrase-less team member, using `app-config secrets ci` subcommand.
Or, for local development, run the `app-config secret agent`!
:::

---

**I'm getting "module not found" or something similar (like "fs" problems), in a web app.**

::: details Answer
Usually, this means you haven't set up our webpack plugin correctly.

Our plugin internally "rewrites" the app-config NPM module, only exposing a very minimal surface.
So it's likely that Webpack is trying to load the Node.js module, but failing because we use
Node.js APIs internally.
:::

---

**How I use App Config with Create React App?**

::: details Answer
Find a way to add Webpack configuration (there's plenty out there), and follow our instructions for that.
:::

---

**How I use App Config with XYZ?**

::: details Answer
File a GitHub issue on our repository, and we'll see if we can officially support it.
:::
