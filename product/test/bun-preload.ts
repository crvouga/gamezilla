// @io-wall-ok — bun:test preload; RN polyfills and module mocks
/**
 * bun:test preload for @product/test — env, RN polyfills, module mocks.
 */
import { mock } from 'bun:test';
import * as linguiCore from '@lingui/core';
import { i18n } from '@lingui/core';
import {
  mockExpoAsset,
  mockExpoClipboard,
  mockExpoHaptics,
  mockExpoHmr,
  mockExpoNativeModules,
  mockExpoSqlite,
  mockReactNativeScreens,
  mockReanimated,
  mockSafeAreaContext,
} from '@pkgs/ui-testing-rntl/bun-rn-test-mocks';
import {
  installExpoTestGlobals,
  mockRnghNativeModule,
  mockRnViewConfigRegistry,
  wrapReactNativeTestNamespace,
} from '@pkgs/ui-testing-rntl/bun-rngh-test-host';

(globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;

// Pin Lingui to this process's singleton. bun's content-addressed install
// can resolve `@lingui/core` to distinct copies per workspace.
mock.module('@lingui/core', () => linguiCore);
i18n.loadAndActivate({ locale: 'en', messages: {} });

const linguiReact = require(
  require.resolve('@lingui/react', {
    paths: [require.resolve('../../pkgs/ui-rn/package.json')],
  })
) as typeof import('@lingui/react');
mock.module('@lingui/react/macro', () => ({
  Trans: linguiReact.Trans,
  useLingui: linguiReact.useLingui,
}));

installExpoTestGlobals();
mockExpoHmr();
mockExpoNativeModules();

mockRnViewConfigRegistry();

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

require('@pkgs/logger').setDefaultLogLevel('error');

process.env['RNTL_SKIP_AUTO_CLEANUP'] = 'true';
process.env['EXPO_PUBLIC_E2E'] = '1';
process.env.NODE_ENV = process.env.NODE_ENV ?? 'test';
process.env['SIM_WITH_RNTL'] = process.env['SIM_WITH_RNTL'] ?? '1';
if (process.env['SIM_REPORT'] === undefined) {
  process.env['SIM_REPORT'] = '0';
}

(function unrefNanostoresUnmountDelay() {
  const NANOSTORES_UNMOUNT_DELAY_MS = 1000;
  const wallSetTimeout = global.setTimeout;
  const patchedSetTimeout = ((
    fn: TimerHandler,
    ms?: number,
    ...args: unknown[]
  ) => {
    const handle = wallSetTimeout(fn, ms, ...args);
    if (
      ms === NANOSTORES_UNMOUNT_DELAY_MS &&
      handle != null &&
      typeof handle === 'object' &&
      typeof (handle as { unref?: () => void }).unref === 'function'
    ) {
      const stack = new Error().stack ?? '';
      if (stack.includes('nanostores')) {
        (handle as { unref: () => void }).unref();
      }
    }
    return handle;
  }) as typeof setTimeout;
  global.setTimeout = patchedSetTimeout;
})();

(function installNodeStoragePolyfill() {
  if (typeof globalThis.localStorage !== 'undefined') return;
  function makeStorage() {
    const map = new Map<string, string>();
    return {
      get length() {
        return map.size;
      },
      clear() {
        map.clear();
      },
      getItem(key: string) {
        return map.get(key) ?? null;
      },
      key(index: number) {
        const keys = [...map.keys()];
        return keys[index] ?? null;
      },
      removeItem(key: string) {
        map.delete(key);
      },
      setItem(key: string, value: string) {
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

mock.module('expo/virtual/env', () => ({
  env: {
    EXPO_PUBLIC_E2E: '1',
  },
}));
mock.module('@shopify/react-native-skia', () =>
  require('./jest-skia-mock.cjs')
);
mock.module('@legendapp/list', () => require('./legend-list-mock.esm.js'));

const ReactNativeNs = require('react-native') as {
  default?: typeof import('react-native');
} & typeof import('react-native');
const ReactNative = wrapReactNativeTestNamespace(
  ReactNativeNs
) as typeof import('react-native');
mock.module('react-native', () => ReactNative);
mockRnghNativeModule();
mockReanimated();
mockSafeAreaContext();
mockReactNativeScreens();
mockExpoClipboard();
mockExpoAsset();
mockExpoHaptics();
mockExpoSqlite();
mock.module('expo-status-bar', () => ({
  StatusBar: () => null,
  setStatusBarStyle: () => undefined,
  setStatusBarHidden: () => undefined,
}));
const { Appearance, Dimensions, NativeModules } = ReactNative;

const PHONE_WINDOW = {
  width: 390,
  height: 844,
  scale: 3,
  fontScale: 1,
};
Dimensions.set({ window: PHONE_WINDOW, screen: PHONE_WINDOW });

if (typeof Appearance.setColorScheme === 'function') {
  Appearance.setColorScheme('dark');
}

if (NativeModules['SourceCode'] == null) {
  NativeModules['SourceCode'] = {};
}
NativeModules['SourceCode'].scriptURL =
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

const appStateStub = {
  currentState: 'active',
  addEventListener: (_type: string, _listener: unknown) => ({
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

try {
  delete (globalThis as { nativeFabricUIManager?: unknown })
    .nativeFabricUIManager;
} catch {
  // ignore
}

const origError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const text = args
    .map((a) =>
      typeof a === 'string' ? a : a instanceof Error ? a.message : ''
    )
    .join(' ');
  if (text.includes('not wrapped in act(...)')) return;
  if (text.includes('Cannot log after tests are done')) return;
  if (text.includes('Database is closed')) return;
  if (text.includes('createSim: server disposed')) return;
  origError(...args);
};
