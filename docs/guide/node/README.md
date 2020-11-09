---
title: Usage in Node.js
---

::: tip Before Reading
Head on over to the [Introduction](../intro/) or [Quick Start](../intro/quick-start) if you haven't already.
:::

Using `app-config` inside of a Node.js app should be easy! If you've set up a schema
and a source for configuration values (as outlined in the intro), there's only two
lines of code required.

```typescript
import { config, loadConfig } from '@lcdev/app-config';

// you're probably best off initializing config ASAP in your program
async function main() {
  await loadConfig();

  console.log({ config });
}
```

Note that files are resolved internally relative to the CWD. Normally, your
app-config files will be located alongside `package.json`. This can be overriden
(see [API Reference](./api-reference)) if you really need to.

## Accessing Config
Your application can treat the config export as an object anywhere that it needs to.
As long as it does not read properties from that object before `loadConfig` has finished
(watch our for race conditions!), it's safe to "just use the export" (note that `config`
is also the default export).

## TypeScript Type Usage

<h4 style="text-align:center">.app-config.meta.yml</h4>

```yaml
generate:
  - { file: 'src/@types/lcdev__app-config/config.d.ts' }
```

```sh
npx app-config generate
```

If your `include` section in tsconfig includes the generated `config.d.ts` file, this should
give types to the `config` export.
