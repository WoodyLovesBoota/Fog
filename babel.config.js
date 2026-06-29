module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    // Reanimated 4 ships its worklets plugin under react-native-worklets.
    // It must be listed last.
    plugins: ['react-native-worklets/plugin'],
  };
};
