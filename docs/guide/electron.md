---
title: Electron Plugin
---

::: tip Before Reading
Head on over to the [Introduction](../intro/) or [Quick Start](../intro/quick-start) if you haven't already.
:::

An example project is available on [GitHub](https://github.com/launchcodedev/app-config/tree/master/examples/electron-project)

The Electron plugin is a separate package, which you'll need to install:

```sh
yarn add -D @app-config/electron@2
```

First, you'll want to load your config in the main Electron process just as you would in any regular Node project, except you may want to wait until your Electron app is ready.

```typescript
import { app, BrowserWindow } from 'electron';
import { addAppConfigPreload } from '@app-config/electron';
import { loadConfig, config } from '@app-config/main';

app.whenReady().then(() => {
  loadConfig().then(() => {
    // run your main Electron code here
  });
});
```

Now you'll probably want to open a browser window. To give the browser window access to your config, you'll need to include App Config's preload script in the `webPreferences` of your browser window:

::: warning Note
The Electron plugin requires `contextIsolation` in your browser window's `webPreferences` to be `true`. This is best security practice, but if your app requires it to be `false` the Electron plugin will not work. `addAppConfigPreload` ensures this is set correctly.
:::

```typescript
app.whenReady().then(() => {
  loadConfig().then(() => {
    const mainWindow = new BrowserWindow({
      webPreferences: addAppConfigPreload(config),
    });

    mainWindow.loadFile('./index.html');
  });
});

```

If you have other `webPreferences` you need to set in addition to the ones that will be set by App Config (like another preload script or parameters), pass them as a second parameter to `addAppConfigPreload`:

```typescript
app.whenReady().then(() => {
  loadConfig().then(() => {
      const mainWindow = new BrowserWindow({
        webPreferences: addAppConfigPreload(config, {
          preload: './my-preload.js',
          additionalArguments: '--my-argument',
        }),
      });

    mainWindow.loadFile('./index.html');
  });
});
```

And that's it! Now your config is available in `window._appConfig` in your browser window. You'll need to restart your app to reflect any configuration changes.

When using our Webpack or Vite plugins (when using the `headerInjection` or `readGlobal` options respectively) it will also be available in the main `config` object if you're using `@app-config/main`.