// @io-wall-ok — bun:test preload; RN polyfills and module mocks
/**
 * bun:test preload for @pkgs/chess-board RNTL tests.
 */
import { mock } from 'bun:test';
import {
  mockExpoAsset,
  mockExpoClipboard,
  mockExpoHaptics,
  mockExpoHmr,
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

installExpoTestGlobals();
mockExpoHmr();

mockRnViewConfigRegistry();

mock.module('react-native-worklets', () => ({ default: {} }));
mock.module('@shopify/react-native-skia', () =>
  require('./jest-skia-mock.cjs')
);

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

mock.module('expo-status-bar', () => ({
  StatusBar: () => null,
  setStatusBarStyle: () => undefined,
  setStatusBarHidden: () => undefined,
}));

try {
  require('react-native/jest/setup');
} catch {
  // Optional: RN ships this for Jest; bun:test can reuse the polyfills.
}

try {
  require('react-native-gesture-handler/jestSetup');
} catch {
  // Optional
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
  origError(...args);
};
