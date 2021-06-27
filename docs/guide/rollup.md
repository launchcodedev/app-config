---
title: Rollup Bundler Plugin
---

::: tip Before Reading
Head on over to the [Introduction](../intro/) or [Quick Start](../intro/quick-start) if you haven't already.
:::

The rollup plugin is a separate package, which you'll need to install:

```sh
yarn add -D @app-config/rollup@2
```

Then add it to your `rollup.config.js`:

```javascript
import appConfig from '@app-config/rollup';

export default {
  plugins: [appConfig()]
}
```

This will allow you to import `@app-config/main` from your application, with all
filesystem and other Node.js code stripped out.

```javascript
import config from '@app-config/main';
```
