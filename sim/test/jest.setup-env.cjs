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
// Reports write HTML frames under sim/console/public/reports. Default off for
// speed; set SIM_REPORT=1 (or any non-"0") to enable console dumps.
if (process.env.SIM_REPORT === undefined) {
  process.env.SIM_REPORT = '0';
}

// Better Auth session atoms sit on nanostores. When the last listener drops,
// nanostores schedules `STORE_UNMOUNT_DELAY` (1000ms) before onMount cleanup.
// Those wall timers keep Jest from exiting (open-handles warning). Unref them
// so cleanup still runs while the process is alive, but does not block exit.
(function unrefNanostoresUnmountDelay() {
  const NANOSTORES_UNMOUNT_DELAY_MS = 1000;
  const wallSetTimeout = global.setTimeout;
  global.setTimeout = function patchedSetTimeout(fn, ms, ...args) {
    const handle = wallSetTimeout(fn, ms, ...args);
    if (
      ms === NANOSTORES_UNMOUNT_DELAY_MS &&
      handle != null &&
      typeof handle === 'object' &&
      typeof handle.unref === 'function'
    ) {
      const stack = new Error().stack ?? '';
      if (stack.includes('nanostores')) {
        handle.unref();
      }
    }
    return handle;
  };
})();

(function installNodeStoragePolyfill() {
  if (typeof globalThis.localStorage !== 'undefined') return;
  function makeStorage() {
    const map = new Map();
    return {
      get length() {
        return map.size;
      },
      clear() {
        map.clear();
      },
      getItem(key) {
        return map.get(key) ?? null;
      },
      key(index) {
        const keys = [...map.keys()];
        return keys[index] ?? null;
      },
      removeItem(key) {
        map.delete(key);
      },
      setItem(key, value) {
        map.set(key, value);
      },
    };
  }
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    enumerable: true,
    value: makeStorage(),
  });
  Object.defineProperty(globalThis, 'sessionStorage', {
    configurable: true,
    enumerable: true,
    value: makeStorage(),
  });
})();

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

// Expo AppState stub for auth session focus listeners; keep stable so
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
