# React Native App Config Transformer

React Native Metro transformer that loads your `app-config` values into bundles statically.

## Installation

### 1. Install `@app-config/main`

```shell
yarn add @app-config/main
```

Or, if you use NPM.

```shell
npm i @app-config/main
```

### 2. Install `@lcdev/react-native-app-config-transformer`

```shell
yarn add -D @lcdev/react-native-app-config-transformer
```

Or, if you use NPM.

```shell
npm i -D @lcdev/react-native-app-config-transformer
```

### 3. Configure React Native bundler (Metro)

Merge the contents of your project's `metro.config.js` file with this config (or create the file if it does not exist already).

`metro.config.js:`

```javascript
module.exports = {
  // Force cache reset in order to load app-config changes
  resetCache: true,
  transformer: {
    babelTransformerPath: require.resolve('@lcdev/react-native-app-config-transformer'),
  },
};
```

## Usage

As it is today, you will need to restart your React Native dev server every time you update `app-config` in order for the changes to take effect.
We are working to see if hot reloading is possible. PR's welcome!
