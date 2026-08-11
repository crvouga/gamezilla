/**
 * Runs before the test module graph loads (see Jest setupFiles).
 * RN getDevServer() needs a non-null scriptURL for Expo / expo-router.
 */
const { NativeModules } = require('react-native');

if (NativeModules.SourceCode == null) {
  NativeModules.SourceCode = {};
}
NativeModules.SourceCode.scriptURL =
  'http://localhost:8081/index.bundle?platform=ios&dev=true';

try {
  const NativeSourceCode =
    require('react-native/Libraries/NativeModules/specs/NativeSourceCode').default;
  if (NativeSourceCode && typeof NativeSourceCode.getConstants === 'function') {
    const constants = NativeSourceCode.getConstants();
    if (constants && constants.scriptURL == null) {
      constants.scriptURL =
        'http://localhost:8081/index.bundle?platform=ios&dev=true';
    }
  }
} catch {
  // Spec may not resolve in every RN layout; NativeModules fallback above remains.
}

// better-auth/expo ExpoFocusManager listens to AppState; keep a stable stub so
// session refresh after dispose cannot crash the Jest process.
const ReactNative = require('react-native');
const appStateStub = {
  currentState: 'active',
  addEventListener: (_type, _listener) => ({
    remove: () => undefined,
  }),
  removeEventListener: () => undefined,
};
try {
  Object.defineProperty(ReactNative, 'AppState', {
    configurable: true,
    enumerable: true,
    get: () => appStateStub,
  });
} catch {
  // If the export is sealed, the getter-based RN shim still wins after teardown.
}

try {
  require('react-native-gesture-handler/jestSetup');
} catch {
  // Optional: package may not expose jestSetup in every install layout.
}

// Worklets Jest prerequisite (Reanimated testing guide). Catalog is 0.7.4 —
// use the package mock (web resolver needs ≥0.8). JS path per Worklets docs.
jest.mock('react-native-worklets', () => {
  const path = require('node:path');
  return require(
    require.resolve('react-native-worklets/lib/module/mock', {
      paths: [path.join(__dirname, '../..', 'apps/client')],
    })
  );
});
