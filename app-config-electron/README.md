# App Config Electron

Easily inject `app-config` values into Electron renderer processes. An example project is provided [here.](https://github.com/launchcodedev/app-config/tree/master/examples/electron-project)

## Usage

### 1. Install App Config and the Electron Package

```shell
yarn add @app-config/main @app-config/electron
```

Or, if you use NPM.

```shell
npm i @app-config/main @app-config/electron
```

### 2. Load your config with any options you need in the main Electron process before creating any windows
```typescript
app.whenReady().then(() => {
  loadConfig().then(() => {
    const mainWindow = new BrowserWindow();

    mainWindow.loadFile('./index.html')
  });
});
```

### 3. Insert the App Config preload script into your `BrowserWindow` `webPreferences`

Pass your config and optionally any other `BrowserWindow` `webPreferences` you need to `addAppConfigPreload`.
```typescript
app.whenReady().then(() => {
  loadConfig().then(() => {
    const mainWindow = new BrowserWindow({
      webPreferences: addAppConfigPreload(config),
    });

    mainWindow.loadFile('./index.html')
  });
});
```

### 4. Your App Config values are now available!

They can be found in `window._appConfig` or in `config` if using `@app-config/main` in your web page (when using `@app-config/webpack` with `headerInjection` or `@app-config/vite` with `readGlobal`). It's also available in `config` in the main Electron process.

Your app will need to be restarted to reflect any configuration changes.

Setting `contextIsolation` to `true` in the `browserOptions` of your `BrowserWindow` settings is required for this package to work. We set this for you, but if your app requres `contextIsolation` to be `false` using this package will break your app.
