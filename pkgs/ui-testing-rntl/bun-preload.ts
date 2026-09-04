// @io-wall-ok — bun:test preload; RN polyfills and module mocks
/**
 * bun:test preload for @pkgs/ui-testing RNTL tests.
 */
import { mock } from 'bun:test';

(globalThis as unknown as { __DEV__: boolean }).__DEV__ = true;

mock.module('react-native-worklets', () => ({ default: {} }));
mock.module('react-native-reanimated', () => {
  const { View } = require('react-native') as typeof import('react-native');
  const createAnimatedComponent = (c: unknown) => c;
  return {
    default: { View, createAnimatedComponent },
    View,
    createAnimatedComponent,
    useSharedValue: (v: unknown) => ({ value: v }),
    useAnimatedStyle: () => ({}),
    useDerivedValue: (fn: () => unknown) => ({ value: fn() }),
    withTiming: (v: unknown) => v,
    withSpring: (v: unknown) => v,
    Easing: { linear: (t: number) => t, inOut: (e: unknown) => e },
    FadeIn: {},
    FadeOut: {},
    runOnJS: (fn: unknown) => fn,
    runOnUI: (fn: unknown) => fn,
    setGestureState: () => undefined,
    setUpTests() {},
  };
});

const ReactNativeNs = require('react-native') as {
  default?: typeof import('react-native');
} & typeof import('react-native');
const ReactNative = new Proxy(
  (ReactNativeNs.default ?? ReactNativeNs) as typeof import('react-native'),
  {
    get(target, prop, receiver) {
      if (prop === 'default') return target;
      return Reflect.get(target, prop, receiver);
    },
  }
);
mock.module('react-native', () => ReactNative);

mock.module('react-native-gesture-handler', () => {
  const { View } = require('react-native') as typeof import('react-native');
  return {
    GestureHandlerRootView: View,
    GestureDetector: View,
    State: {
      UNDETERMINED: 0,
      FAILED: 1,
      BEGAN: 2,
      CANCELLED: 3,
      ACTIVE: 4,
      END: 5,
    },
    Gesture: {
      Pan: () => ({
        onBegin() {
          return this;
        },
        onUpdate() {
          return this;
        },
        onEnd() {
          return this;
        },
      }),
      Tap: () => ({
        onEnd() {
          return this;
        },
      }),
      Exclusive: (..._g: unknown[]) => ({}),
    },
  };
});
mock.module('react-native-gesture-handler/jest-utils', () => ({
  fireGestureHandler: () => undefined,
  getByGestureTestId: () => ({ handlerTag: 1 }),
}));

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
