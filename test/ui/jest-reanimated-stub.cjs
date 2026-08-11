/** Library-shaped Reanimated stub for Jest (no native worklets). */
const id = (value) => value;

const Easing = {
  linear: id,
  ease: id,
  quad: id,
  cubic: id,
  poly: id,
  sin: id,
  circle: id,
  exp: id,
  elastic: id,
  back: id,
  bounce: id,
  bezier: () => ({ factory: id }),
  bezierFn: id,
  steps: id,
  in: id,
  out: id,
  inOut: id,
};

const NOOP = () => undefined;
const NOOP_WITH_VALUE = (value) => value;

const Animated = {
  View: 'View',
  Text: 'Text',
  Image: 'Image',
  ScrollView: 'ScrollView',
  FlatList: 'FlatList',
  createAnimatedComponent: (Component) => Component,
  call: NOOP,
  addWhitelistedNativeProps: NOOP,
  addWhitelistedUIProps: NOOP,
  Easing,
};

const api = {
  Easing,
  useSharedValue: (value) => ({ value }),
  useAnimatedStyle: () => ({}),
  useAnimatedProps: () => ({}),
  useAnimatedRef: () => ({ current: null }),
  useAnimatedScrollHandler: () => NOOP,
  useAnimatedReaction: NOOP,
  useDerivedValue: (fn) => ({ value: typeof fn === 'function' ? fn() : fn }),
  // Gesture Handler imports these off the Reanimated namespace.
  useEvent: () => NOOP,
  useHandler: () => ({ doDependenciesDiffer: false, useWeb: true }),
  useWorkletCallback: (fn) => fn,
  withTiming: NOOP_WITH_VALUE,
  withSpring: NOOP_WITH_VALUE,
  withDelay: (_d, value) => value,
  withSequence: NOOP_WITH_VALUE,
  withRepeat: NOOP_WITH_VALUE,
  cancelAnimation: NOOP,
  runOnJS: (fn) => fn,
  runOnUI: (fn) => fn,
  interpolate: NOOP_WITH_VALUE,
  Extrapolation: { CLAMP: 'clamp', EXTEND: 'extend', IDENTITY: 'identity' },
  FadeIn: {},
  FadeOut: {},
  Layout: {},
  SlideInDown: {},
  SlideOutDown: {},
  createAnimatedComponent: (Component) => Component,
};

module.exports = {
  __esModule: true,
  default: Object.assign({}, Animated, api),
  ...api,
};
