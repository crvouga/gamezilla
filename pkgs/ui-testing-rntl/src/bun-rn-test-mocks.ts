// @io-wall-ok — bun:test module mocks for RN / Expo packages without natives
import { mock } from 'bun:test';
import type { StyleProp, ViewStyle } from 'react-native';

/** RNTL host: SafeArea native component is unavailable under bun:test. */
export function mockSafeAreaContext(): void {
  mock.module('react-native-safe-area-context', () => {
    const React = require('react') as typeof import('react');
    const { View } = require('react-native') as typeof import('react-native');
    const insets = { top: 0, right: 0, bottom: 0, left: 0 };
    const frame = { x: 0, y: 0, width: 390, height: 844 };
    /** Library provider fills its parent (`styles.fill`); keep the height chain. */
    const SafeAreaProvider = ({
      style,
      ...rest
    }: {
      style?: StyleProp<ViewStyle>;
      children?: React.ReactNode;
    }) => React.createElement(View, { ...rest, style: [{ flex: 1 }, style] });
    return {
      SafeAreaProvider,
      SafeAreaView: View,
      SafeAreaInsetsContext: React.createContext(insets),
      SafeAreaFrameContext: React.createContext(frame),
      useSafeAreaInsets: () => insets,
      useSafeAreaFrame: () => frame,
      initialWindowMetrics: { insets, frame },
    };
  });
}

/** RNTL host: screens native views are unavailable under bun:test. */
export function mockReactNativeScreens(): void {
  mock.module('react-native-screens', () => {
    const { View } = require('react-native') as typeof import('react-native');
    return {
      enableScreens: () => undefined,
      enableFreeze: () => undefined,
      screensEnabled: () => false,
      Screen: View,
      ScreenContainer: View,
      ScreenStack: View,
      ScreenStackHeaderConfig: View,
      NativeScreen: View,
      NativeScreenContainer: View,
      NativeScreenNavigationContainer: View,
      SearchBar: View,
      FullWindowOverlay: View,
    };
  });
}

/** Official Reanimated is a native JSI module; stub the JS API for RNTL. */
export function mockReanimated(): void {
  const factory = () => {
    const { View } = require('react-native') as typeof import('react-native');
    const createAnimatedComponent = (c: unknown) => c;
    const identity = (v: unknown) => v;
    return {
      default: { View, createAnimatedComponent },
      View,
      createAnimatedComponent,
      useSharedValue: (v: unknown) => ({ value: v }),
      useAnimatedStyle: () => ({}),
      useAnimatedScrollHandler: () => () => undefined,
      useAnimatedRef: () => ({ current: null }),
      useAnimatedReaction: () => undefined,
      useEvent: () => undefined,
      useHandler: () => ({ context: {}, doDependenciesDiffer: false }),
      useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
      withTiming: identity,
      withSpring: identity,
      withDelay: (_d: unknown, v: unknown) => v,
      withSequence: identity,
      withRepeat: identity,
      cancelAnimation: () => undefined,
      interpolate: () => 0,
      interpolateColor: () => 'transparent',
      Easing: {
        linear: (t: number) => t,
        inOut: (e: unknown) => e,
        in: (e: unknown) => e,
        out: (e: unknown) => e,
        cubic: (t: number) => t,
        bezier: () => (t: number) => t,
      },
      FadeIn: {},
      FadeOut: {},
      LinearTransition: {},
      runOnJS: (fn: unknown) => fn,
      runOnUI: (fn: unknown) => fn,
      setGestureState: () => undefined,
      setUpTests: () => undefined,
      scrollTo: () => undefined,
      measure: () => ({ x: 0, y: 0, width: 0, height: 0, pageX: 0, pageY: 0 }),
      Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
    };
  };
  mock.module('react-native-reanimated', factory);
  mock.module(require.resolve('react-native-reanimated'), factory);
}

/** Native clipboard view is unavailable under bun:test. */
export function mockExpoClipboard(): void {
  mock.module('expo-clipboard', () => {
    const { View } = require('react-native') as typeof import('react-native');
    return {
      setStringAsync: async () => true,
      getStringAsync: async () => '',
      hasStringAsync: async () => false,
      ClipboardPasteButton: View,
    };
  });
}

/** expo-asset native module is unavailable under bun:test. */
export function mockExpoAsset(): void {
  const asset = {
    downloadAsync: async () => undefined,
    localUri: '',
    uri: '',
    name: 'mock',
    type: 'png',
    hash: null,
    width: 1,
    height: 1,
  };
  mock.module('expo-asset', () => ({
    Asset: {
      fromModule: () => asset,
      fromURI: () => asset,
      loadAsync: async () => [asset],
    },
  }));
}

/** expo-haptics native module is unavailable under bun:test. */
export function mockExpoHaptics(): void {
  const noop = async () => undefined;
  mock.module('expo-haptics', () => ({
    selectionAsync: noop,
    impactAsync: noop,
    notificationAsync: noop,
    ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
    NotificationFeedbackType: {
      Success: 'success',
      Warning: 'warning',
      Error: 'error',
    },
  }));
}

/** expo-modules-core native lookups fail under bun:test. */
export function mockExpoNativeModules(): void {
  function EventEmitter(): void {}
  EventEmitter.prototype.addListener = function addListener(): {
    remove(): void;
  } {
    return { remove() {} };
  };
  EventEmitter.prototype.removeListener = function removeListener(): void {};
  EventEmitter.prototype.emit = function emit(): void {};
  class CodedError extends Error {
    code: string;
    constructor(code: string, message?: string) {
      super(message ?? code);
      this.code = code;
    }
  }
  function UnavailabilityError(mod: string, prop = ''): CodedError {
    const err = new CodedError('ERR_UNAVAILABLE', `${mod}.${prop} unavailable`);
    err.name = 'UnavailabilityError';
    return err;
  }
  function NativeModule(): void {}
  function SharedObject(): void {}
  function SharedRef(): void {}
  function FileSystemFile(): void {}
  function FileSystemDirectory(): void {}
  mock.module('expo-modules-core', () => ({
    EventEmitter,
    NativeModule,
    SharedObject,
    SharedRef,
    Platform: { OS: 'ios' },
    uuid: { v4: () => '00000000-0000-4000-8000-000000000000' },
    requireNativeViewManager: () => 'View',
    requireNativeModule: (name?: string) => {
      if (name === 'FileSystem' || name === 'ExpoFileSystem') {
        return { FileSystemFile, FileSystemDirectory };
      }
      return {};
    },
    requireOptionalNativeModule: () => ({}),
    registerWebModule: () => undefined,
    CodedError,
    UnavailabilityError,
    LegacyEventEmitter: EventEmitter,
    NativeModulesProxy: {},
    installOnUIRuntime: () => undefined,
  }));
  mock.module('expo-device', () => ({
    brand: 'Apple',
    manufacturer: 'Apple',
    modelName: 'iPhone',
    osName: 'iOS',
    osVersion: '18.0',
    deviceType: 1,
    isDevice: false,
  }));
  mock.module('expo-constants', () => {
    const constants = { expoConfig: {}, appOwnership: null };
    return { default: constants, ...constants };
  });
}

/** Native ExpoSQLite is unavailable under bun:test; sim injects Node sqlite. */
export function mockExpoSqlite(): void {
  const db = {
    execAsync: async () => undefined,
    runAsync: async () => ({ changes: 0, lastInsertRowId: 0 }),
    getAllAsync: async () => [],
    getFirstAsync: async () => null,
    closeAsync: async () => undefined,
    withTransactionAsync: async (fn: () => Promise<void>) => fn(),
  };
  const sqlite = {
    openDatabaseAsync: async () => db,
    openDatabaseSync: () => db,
    deleteDatabaseAsync: async () => undefined,
  };
  mock.module('expo-sqlite', () => sqlite);
  mock.module('expo-sqlite/build/ExpoSQLite', () => ({
    default: {},
    requireNativeModule: () => ({}),
  }));
}

/** React Navigation linking reads `window.history` / `location` under bun:test. */
export function installDomTestGlobals(): void {
  const g = globalThis as unknown as {
    history?: object;
    location?: object;
    document?: {
      title: string;
      visibilityState?: string;
      querySelectorAll: (sel?: string) => unknown;
      querySelector: (sel?: string) => unknown;
      createElement: (tag?: string) => object;
      addEventListener: (...args: unknown[]) => void;
      removeEventListener: (...args: unknown[]) => void;
      body: object;
      head: object;
    };
  };
  let state: unknown = null;
  g.history ??= {
    get state() {
      return state;
    },
    pushState(next: unknown) {
      state = next;
    },
    replaceState(next: unknown) {
      state = next;
    },
    go() {},
    back() {},
    forward() {},
    length: 1,
  };
  g.location ??= {
    protocol: 'http:',
    host: 'localhost',
    hostname: 'localhost',
    href: 'http://localhost/',
    origin: 'http://localhost',
    pathname: '/',
    search: '',
    hash: '',
  };
  g.document ??= {
    title: '',
    visibilityState: 'visible',
    querySelectorAll: () => [],
    querySelector: () => null,
    createElement: () => ({
      remove() {},
      setAttribute() {},
      style: {},
      appendChild() {},
    }),
    addEventListener() {},
    removeEventListener() {},
    body: { append() {}, appendChild() {}, remove() {} },
    head: { appendChild() {}, querySelectorAll: () => [] },
  };
  if (typeof globalThis.requestAnimationFrame !== 'function') {
    globalThis.requestAnimationFrame = ((cb: (time: number) => void) => {
      cb(0);
      return 0;
    }) as typeof requestAnimationFrame;
    globalThis.cancelAnimationFrame = (() =>
      undefined) as typeof cancelAnimationFrame;
  }
}

/** Expo Metro HMR sockets must not open during bun:test. */
export function mockExpoHmr(): void {
  const empty = (): object => ({});
  mock.module('expo/src/async-require/messageSocket', empty);
  mock.module('expo/src/async-require/setupHMR', empty);
  mock.module('expo/src/async-require/setup', empty);
  mock.module('expo/src/Expo.fx', empty);
}
