// @io-wall-ok — bun:test preload helpers for React Native Gesture Handler
import { mock } from 'bun:test';

import { installDomTestGlobals } from './bun-rn-test-mocks';

/** Flow-only package (no `.d.ts`): CSS color → RGBA uint32, or null when invalid. */
const normalizeColor = require('@react-native/normalize-colors') as (
  color: string | number
) => number | null | undefined;

const VIEW_CONFIG_REGISTRY =
  'react-native/Libraries/Renderer/shims/ReactNativeViewConfigRegistry';

const RNGH_NATIVE_MODULE_IDS = [
  'react-native-gesture-handler/lib/commonjs/RNGestureHandlerModule',
  'react-native-gesture-handler/src/RNGestureHandlerModule',
  'react-native-gesture-handler/lib/module/RNGestureHandlerModule',
];

/** Stub the RN renderer registry RNGH writes gesture event types into. */
export function mockRnViewConfigRegistry(): void {
  mock.module(VIEW_CONFIG_REGISTRY, () => ({
    customDirectEventTypes: {},
    customBubblingEventTypes: {},
    register: (name: string) => name,
  }));
  mock.module('react-native/Libraries/Utilities/codegenNativeComponent', () => {
    const codegen = (name: string) => name;
    return { default: codegen, __esModule: true };
  });
}

/**
 * RN `processColor` without the native PlatformColor branch: CSS color →
 * ARGB uint32 (react-native-svg `extractBrush` needs a number or it drops the
 * paint as `none`). Numbers are assumed already processed.
 */
export function processColorForTest(color: unknown): number | null | undefined {
  if (color === undefined || color === null) return color;
  if (typeof color === 'number') return color;
  const normalized = normalizeColor(color as string);
  if (typeof normalized !== 'number') return undefined;
  // 0xrrggbbaa → 0xaarrggbb
  return ((normalized << 24) | (normalized >>> 8)) >>> 0;
}

function defineHost(reactNative: object, name: string, value: unknown): void {
  Object.defineProperty(reactNative, name, {
    configurable: true,
    enumerable: true,
    get: () => value,
  });
}

function touchableMixin(): object {
  return {
    touchableHandleStartShouldSetResponder: () => false,
    touchableHandleResponderTerminationRequest: () => true,
    touchableHandleResponderGrant: () => undefined,
    touchableHandleResponderMove: () => undefined,
    touchableHandleResponderRelease: () => undefined,
    touchableHandleResponderTerminate: () => undefined,
    touchableGetInitialState: () => ({}),
  };
}

function rnAnimated(): object {
  class Value {
    constructor(public _value = 0) {}
    setValue(): void {}
    interpolate(): this {
      return this;
    }
    addListener(): string {
      return '0';
    }
    removeListener(): void {}
    stopAnimation(): void {}
  }
  const startStop = () => ({ start: () => undefined, stop: () => undefined });
  return {
    View: 'View',
    Text: 'Text',
    Image: 'Image',
    ScrollView: 'RCTScrollView',
    createAnimatedComponent: (c: unknown) => c,
    timing: startStop,
    spring: startStop,
    decay: startStop,
    loop: (anim: unknown) => anim ?? startStop(),
    sequence: () => startStop(),
    parallel: () => startStop(),
    delay: () => startStop(),
    Value,
    event: () => () => undefined,
  };
}

function rnEasing(): object {
  const linear = (t: number) => t;
  return {
    linear,
    ease: linear,
    in: (e: (t: number) => number) => e,
    out: (e: (t: number) => number) => e,
    inOut: (e: (t: number) => number) => e,
    bezier: () => linear,
    cubic: linear,
  };
}

function rnI18nManager(): object {
  const constants = { isRTL: false, doLeftAndRightSwapInRTL: true };
  return {
    isRTL: false,
    getConstants: () => constants,
    allowRTL: () => undefined,
    forceRTL: () => undefined,
    swapLeftAndRightInRTL: () => undefined,
  };
}

function rnBackHandler(): object {
  return {
    addEventListener: () => ({ remove: () => undefined }),
    removeEventListener: () => undefined,
    exitApp: () => undefined,
  };
}

/** RNTL has no viewport; RN VirtualizedList never mounts cells. */
function rnNonVirtualizingList(): unknown {
  const React = require('react') as typeof import('react');
  return function List(props: {
    data?: readonly unknown[];
    renderItem?: (info: { item: unknown; index: number }) => unknown;
    keyExtractor?: (item: unknown, index: number) => string;
    ListHeaderComponent?: unknown;
    ListFooterComponent?: unknown;
    ListEmptyComponent?: unknown;
    style?: unknown;
    contentContainerStyle?: unknown;
    testID?: string;
  }) {
    const data = props.data ?? [];
    const wrap = (value: unknown) => {
      if (value == null) return null;
      if (React.isValidElement(value)) return value;
      if (typeof value === 'function') {
        return React.createElement(value as never);
      }
      return null;
    };
    const rows =
      data.length === 0
        ? wrap(props.ListEmptyComponent)
        : data.map((item, index) => {
            const key =
              typeof props.keyExtractor === 'function'
                ? props.keyExtractor(item, index)
                : String(index);
            const row =
              typeof props.renderItem === 'function'
                ? props.renderItem({ item, index })
                : null;
            return React.createElement('View', { key }, row as never);
          });
    return React.createElement(
      'RCTScrollView',
      {
        style: props.style,
        contentContainerStyle: props.contentContainerStyle,
        testID: props.testID,
      },
      wrap(props.ListHeaderComponent),
      rows,
      wrap(props.ListFooterComponent)
    );
  };
}

function rnPressableHost(): unknown {
  const React = require('react') as typeof import('react');
  return function Pressable(props: { style?: unknown; children?: unknown }) {
    const state = { pressed: false, hovered: false };
    const resolvedStyle =
      typeof props.style === 'function'
        ? (props.style as (s: { pressed: boolean }) => unknown)(state)
        : props.style;
    const content =
      typeof props.children === 'function'
        ? (props.children as (s: { pressed: boolean }) => unknown)(state)
        : props.children;
    const rest = { ...props, style: resolvedStyle };
    delete rest.children;
    return React.createElement('View', rest, content as never);
  };
}

export function stubReactNativeHostApis(reactNative: object): void {
  const uiManager = {
    genericDirectEventTypes: {},
    getViewManagerConfig: () => undefined,
    setJSResponder: () => undefined,
    clearJSResponder: () => undefined,
    hasViewManagerConfig: () => false,
    dispatchViewManagerCommand: () => undefined,
    measure: () => undefined,
    measureInWindow: () => undefined,
    measureLayout: () => undefined,
  };
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  const deviceEventEmitter = {
    addListener(event: string, cb: (payload: unknown) => void) {
      let set = listeners.get(event);
      if (!set) {
        set = new Set();
        listeners.set(event, set);
      }
      set.add(cb);
      return { remove: () => set.delete(cb) };
    },
    emit(event: string, payload: unknown) {
      for (const cb of listeners.get(event) ?? []) cb(payload);
    },
    removeAllListeners(event?: string) {
      if (event) listeners.delete(event);
      else listeners.clear();
    },
  };
  defineHost(reactNative, 'UIManager', uiManager);
  defineHost(reactNative, 'DeviceEventEmitter', deviceEventEmitter);
  defineHost(reactNative, 'Touchable', { Mixin: touchableMixin() });
  defineHost(reactNative, 'processColor', processColorForTest);
  defineHost(reactNative, 'codegenNativeComponent', (name: string) => name);
  defineHost(reactNative, 'PanResponder', {
    create: () => ({ panHandlers: {} }),
  });
  defineHost(reactNative, 'Platform', {
    OS: 'ios',
    select: (spec: { ios?: unknown; default?: unknown }) =>
      spec.ios ?? spec.default,
    isPad: false,
    isTV: false,
  });
  defineHost(reactNative, 'AppRegistry', {
    registerComponent: () => undefined,
    runApplication: () => undefined,
  });
  defineHost(reactNative, 'Appearance', {
    getColorScheme: () => 'dark',
    setColorScheme: () => undefined,
    addChangeListener: () => ({ remove: () => undefined }),
  });
  defineHost(reactNative, 'useColorScheme', () => 'dark');
  defineHost(reactNative, 'Easing', rnEasing());
  defineHost(reactNative, 'Animated', rnAnimated());
  defineHost(reactNative, 'I18nManager', rnI18nManager());
  defineHost(reactNative, 'BackHandler', rnBackHandler());
  defineHost(reactNative, 'KeyboardAvoidingView', 'View');
  defineHost(reactNative, 'Pressable', rnPressableHost());
  stubReactNativeTouchables(reactNative);
  stubReactNativeListAndLayout(reactNative);
}

function stubReactNativeTouchables(reactNative: object): void {
  for (const name of [
    'TouchableNativeFeedback',
    'TouchableHighlight',
    'TouchableOpacity',
    'TouchableWithoutFeedback',
    'Switch',
    'DrawerLayoutAndroid',
  ] as const) {
    defineHost(reactNative, name, 'View');
  }
}

function stubReactNativeListAndLayout(reactNative: object): void {
  defineHost(reactNative, 'FlatList', rnNonVirtualizingList());
  defineHost(reactNative, 'SectionList', rnNonVirtualizingList());
  defineHost(reactNative, 'findNodeHandle', () => 1);
  const window = { width: 390, height: 844, scale: 3, fontScale: 1 };
  defineHost(reactNative, 'Dimensions', {
    get: () => window,
    set: () => undefined,
    addEventListener: () => ({ remove: () => undefined }),
    removeEventListener: () => undefined,
  });
  defineHost(reactNative, 'NativeModules', {
    SourceCode: {
      scriptURL: 'http://localhost:8081/index.bundle?platform=ios&dev=true',
    },
  });
}

/** Replace RNGH's native module the way `jestSetup` does under Jest. */
export function mockRnghNativeModule(): void {
  const mocks =
    require('react-native-gesture-handler/lib/commonjs/mocks/mocks') as object;
  for (const id of RNGH_NATIVE_MODULE_IDS) {
    mock.module(id, () => mocks);
  }
  const findNode = { default: () => 1, __esModule: true };
  mock.module(
    'react-native-gesture-handler/lib/commonjs/findNodeHandle',
    () => findNode
  );
  mock.module(
    'react-native-gesture-handler/src/findNodeHandle',
    () => findNode
  );
}

function unwrapRnExport(value: unknown): unknown {
  let current = value;
  for (let i = 0; i < 4; i++) {
    if (typeof current === 'function' || typeof current === 'string') {
      return current;
    }
    if (
      current &&
      typeof current === 'object' &&
      'default' in current &&
      (current as { default: unknown }).default != null &&
      (current as { default: unknown }).default !== current
    ) {
      current = (current as { default: unknown }).default;
      continue;
    }
    break;
  }
  return current;
}

/** Proxy RN so CJS `require('react-native').foo` is a function, not a Module. */
export function wrapReactNativeTestNamespace(
  ns: { default?: object } & object
): object {
  const target = (ns.default ?? ns) as object;
  stubReactNativeHostApis(target);
  return new Proxy(target, {
    get(obj, prop, receiver) {
      if (prop === 'default') return receiver;
      return unwrapRnExport(Reflect.get(obj, prop, receiver));
    },
  });
}

function ExpoEventEmitter(): void {}
ExpoEventEmitter.prototype.addListener = function addListener(): {
  remove(): void;
} {
  return { remove() {} };
};
ExpoEventEmitter.prototype.removeListener = function removeListener(): void {};
ExpoEventEmitter.prototype.emit = function emit(): void {};

/** Minimal `globalThis.expo` so expo-modules-core can load under bun:test. */
export function installExpoTestGlobals(): void {
  process.env['EXPO_OS'] = process.env['EXPO_OS'] ?? 'ios';
  const g = globalThis as unknown as {
    expo?: { EventEmitter: unknown };
    window?: unknown;
    __fbBatchedBridgeConfig?: { remoteModuleConfig: unknown[] };
  };
  g.window ??= globalThis;
  g.__fbBatchedBridgeConfig ??= { remoteModuleConfig: [] };
  installDomTestGlobals();
  if (g.expo?.EventEmitter != null) return;
  g.expo = { EventEmitter: ExpoEventEmitter };
}
