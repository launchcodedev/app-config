---
title: Vite Bundler Plugin
---

::: tip Before Reading
Head on over to the [Introduction](../intro/) or [Quick Start](../intro/quick-start) if you haven't already.
:::

The vite plugin is a separate package, which you'll need to install:

```sh
yarn add -D @app-config/vite@2
```

Then add it to your `vite.config.js`:

```javascript
import appConfig from '@app-config/vite';

// https://vitejs.dev/config/
export default {
  plugins: [appConfig()]
}
```

This will allow you to import `@app-config/main` from your application, with all
filesystem and other Node.js code stripped out.

```javascript
import config from '@app-config/main';
```
