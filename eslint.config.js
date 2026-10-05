// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // src/diorama is the WebGL map scene (browser code, three.js JSX) — outside the RN lint rules.
    ignores: ["dist/*", "src/diorama/*"],
  }
]);
