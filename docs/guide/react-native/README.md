---
title: Usage in React Native
---

::: tip Before Reading
Head on over to the [Introduction](../intro/) or [Quick Start](../intro/quick-start) if you haven't already.
:::

The React Native transformer is a separate package, which you'll need to install:

```shell
yarn add -D @lcdev/react-native-app-config-transformer@2
```

### Configure React Native bundler (Metro)

Merge the contents of your project's `metro.config.js` file with this config (or create the file if it does not exist already).

`metro.config.js:`

```javascript
module.exports = (async () => ({
  // Force cache reset in order to load app-config changes
  resetCache: true,
  transformer: {
    babelTransformerPath: require.resolve('@lcdev/react-native-app-config-transformer'),
  },
}))();
```

## Usage

As it is today, you will need to restart your React Native dev server every time
you update `app-config` in order for the changes to take effect. We are working
to see if hot reloading is possible. PR's welcome!
