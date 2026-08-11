/**
 * Bridge so `require('react-native-reanimated')` resolves to the library's
 * own Jest mock without sharing the same module id as
 * `react-native-reanimated/mock` (expo-router's jest.mock factory would
 * otherwise circular-require itself and return `{}`).
 */
const path = require('node:path');

module.exports = require(
  require.resolve('react-native-reanimated/lib/module/mock', {
    paths: [path.join(__dirname, '../..', 'apps/client')],
  })
);
