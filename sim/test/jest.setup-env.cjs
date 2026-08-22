/**
 * Runs before the test module graph loads (see Jest setupFiles).
 * RN getDevServer() needs a non-null scriptURL for Expo / expo-router.
 */

// jest-expo / RN env often lacks ERM well-known symbols. Without these,
// `async [Symbol.asyncDispose]()` keys under `undefined` while Babel's
// `usingCtx` looks up `Symbol.for('Symbol.asyncDispose')` → not disposable.
if (typeof Symbol.dispose !== 'symbol') {
  Object.defineProperty(Symbol, 'dispose', {
    value: Symbol.for('Symbol.dispose'),
    configurable: true,
    enumerable: false,
    writable: false,
  });
}
if (typeof Symbol.asyncDispose !== 'symbol') {
  Object.defineProperty(Symbol, 'asyncDispose', {
    value: Symbol.for('Symbol.asyncDispose'),
    configurable: true,
    enumerable: false,
    writable: false,
  });
}

// Drop debug/info/warn JSON from `@pkgs/logger` so Jest does not wrap every
// line with a stack dump. Error still prints when a sim actually fails.
require('@pkgs/logger').setDefaultLogLevel('error');

// Product sims unmount in `sim.dispose()`. RNTL afterEach `cleanup()` would
// call the same async `act(unmount)` again and hang (180s hook timeout).
process.env.RNTL_SKIP_AUTO_CLEANUP = 'true';
// Reports write to sim/console/public/reports by default (sim console UI).
// Set SIM_REPORT=0 to skip HTML frame I/O for a faster suite.
const { Appearance, Dimensions, NativeModules } = require('react-native');

// Phone frame matching the simulation report iframe (390×844).
const PHONE_WINDOW = {
  width: 390,
  height: 844,
  scale: 3,
  fontScale: 1,
};
Dimensions.set({ window: PHONE_WINDOW, screen: PHONE_WINDOW });

// Dark theme tokens in `dataSet.css` (AppThemeRoot follows system appearance).
if (typeof Appearance.setColorScheme === 'function') {
  Appearance.setColorScheme('dark');
}
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: () => 'dark',
}));

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

// Fabric detection makes RNGH call native `install()` during RootView render.
try {
  delete global.nativeFabricUIManager;
} catch {
  // ignore
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
