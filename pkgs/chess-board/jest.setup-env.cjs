/**
 * Jest setupFiles (before env) for @pkgs/chess-board black-box UI tests.
 */

try {
  require('react-native-gesture-handler/jestSetup');
} catch {
  // Optional: package may not expose jestSetup in every install layout.
}

try {
  delete global.nativeFabricUIManager;
} catch {
  // ignore
}

// Worklets Jest prerequisite (Reanimated testing guide).
jest.mock('react-native-worklets', () => {
  const path = require('node:path');
  return require(
    require.resolve('react-native-worklets/lib/module/mock', {
      paths: [path.join(__dirname, '../..', 'apps/client')],
    })
  );
});
