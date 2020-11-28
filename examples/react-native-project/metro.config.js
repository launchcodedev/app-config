module.exports = (async () => {
  return {
    // Force cache reset in order to load app-config changes
    resetCache: true,
    transformer: {
      babelTransformerPath: require.resolve('@lcdev/react-native-app-config-transformer'),
    },
  };
})();
