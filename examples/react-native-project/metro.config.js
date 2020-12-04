const { createMetroConfiguration } = require('expo-yarn-workspaces');

module.exports = Object.assign(createMetroConfiguration(__dirname), {
  // Force cache reset in order to load app-config changes
  resetCache: true,
  transformer: {
    babelTransformerPath: require.resolve('@lcdev/react-native-app-config-transformer'),
  },
});
