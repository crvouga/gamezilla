/** CJS interop helpers injected ahead of Expo's compiled RN index IIFE. */
export const REACT_NATIVE_INDEX_HELPERS = `
function unwrapDefault(mod) {
  let current = mod;
  for (let i = 0; i < 6; i++) {
    if (typeof current === 'function') return current;
    if (current && typeof current === 'object') {
      if (typeof current.default === 'function') return current.default;
      if (
        'default' in current &&
        current.default != null &&
        current.default !== current
      ) {
        current = current.default;
        continue;
      }
      for (const key of Object.keys(current)) {
        if (typeof current[key] === 'function' && key !== '__esModule') {
          return current[key];
        }
      }
    }
    break;
  }
  return current;
}
function interopRequire(id) {
  const raw = unwrapDefault(require(id));
  if (typeof raw === 'function') {
    return new Proxy(raw, {
      get(target, prop, receiver) {
        if (prop === 'default') return target;
        return Reflect.get(target, prop, receiver);
      },
    });
  }
  if (raw && typeof raw === 'object') {
    return new Proxy(raw, {
      get(target, prop, receiver) {
        if (prop === 'default' && !Reflect.has(target, 'default')) {
          return target;
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  }
  return { default: raw };
}
`.trim();

/**
 * RNTL has no viewport; RN VirtualizedList never mounts cells. Injected into
 * the transformed `react-native/index.js` so ESM `import { FlatList }` is a
 * real list, not a Module namespace.
 */
export const REACT_NATIVE_NON_VIRTUALIZING_LIST = `
function rnPressable(props) {
  const React = require('react');
  const state = { pressed: false, hovered: false };
  const resolvedStyle =
    typeof props.style === 'function' ? props.style(state) : props.style;
  const content =
    typeof props.children === 'function'
      ? props.children(state)
      : props.children;
  const rest = { ...props, style: resolvedStyle };
  delete rest.children;
  return React.createElement('View', rest, content);
}
function rnNonVirtualizingList() {
  const React = require('react');
  return function List(props) {
    const data = props.data ?? [];
    const wrap = (value) => {
      if (value == null) return null;
      if (React.isValidElement(value)) return value;
      if (typeof value === 'function') return React.createElement(value);
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
            return React.createElement('View', { key }, row);
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
const NonVirtualizingList = rnNonVirtualizingList();
Object.defineProperty(module.exports, 'Pressable', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: rnPressable,
});
Object.defineProperty(module.exports, 'FlatList', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: NonVirtualizingList,
});
Object.defineProperty(module.exports, 'SectionList', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: NonVirtualizingList,
});
`.trim();

/** Host stubs + lazy named exports injected after the RN index IIFE. */
export const REACT_NATIVE_INDEX_TAIL = `
Object.defineProperty(module.exports, 'Platform', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: {
    OS: 'ios',
    select: (spec) => spec.ios ?? spec.default,
    isPad: false,
    isTV: false,
  },
});
Object.defineProperty(module.exports, 'Dimensions', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: {
    get: () => ({ width: 390, height: 844, scale: 3, fontScale: 1 }),
    set: () => undefined,
    addEventListener: () => ({ remove: () => undefined }),
    removeEventListener: () => undefined,
  },
});
Object.defineProperty(module.exports, 'Appearance', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: {
    getColorScheme: () => 'dark',
    setColorScheme: () => undefined,
    addChangeListener: () => ({ remove: () => undefined }),
  },
});
Object.defineProperty(module.exports, 'NativeModules', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: {
    SourceCode: {
      scriptURL: 'http://localhost:8081/index.bundle?platform=ios&dev=true',
    },
  },
});
function rnFlattenStyle(style) {
  if (style == null || typeof style !== 'object') return undefined;
  if (!Array.isArray(style)) return style;
  const result = {};
  for (const entry of style) {
    const flat = rnFlattenStyle(entry);
    if (flat == null) continue;
    for (const key of Object.keys(flat)) result[key] = flat[key];
  }
  return result;
}
const rnAbsoluteFillObject = Object.freeze({
  position: 'absolute',
  left: 0,
  right: 0,
  top: 0,
  bottom: 0,
});
Object.defineProperty(module.exports, 'StyleSheet', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: {
    create: (styles) => styles,
    flatten: rnFlattenStyle,
    compose: (a, b) => (a != null && b != null ? [a, b] : (a ?? b)),
    absoluteFill: rnAbsoluteFillObject,
    absoluteFillObject: rnAbsoluteFillObject,
    hairlineWidth: 1,
  },
});
Object.defineProperty(module.exports, 'TurboModuleRegistry', {
  configurable: true,
  enumerable: true,
  value: {
    getEnforcing: () => ({}),
    get: () => ({}),
  },
});
Object.defineProperty(module.exports, 'useColorScheme', {
  configurable: true,
  enumerable: true,
  writable: true,
  value: () => 'dark',
});
function unwrapLazyRnValue(value) {
  let current = value;
  for (let i = 0; i < 6; i++) {
    if (typeof current === 'function' || typeof current === 'string') {
      return current;
    }
    if (
      current &&
      typeof current === 'object' &&
      'default' in current &&
      current.default != null &&
      current.default !== current
    ) {
      current = current.default;
      continue;
    }
    break;
  }
  return current;
}
/** Plain functions on the RN index: calling them must not create an element. */
const RN_CALLABLE_EXPORTS = new Set([
  'processColor',
  'findNodeHandle',
  'requireNativeComponent',
  'registerCallableModule',
  'unstable_batchedUpdates',
]);
function isRnCallableExport(name) {
  return RN_CALLABLE_EXPORTS.has(name) || name.startsWith('use');
}
function lazyExport(name) {
  return new Proxy(function lazyRnExport() {}, {
      get(_target, prop) {
        const value = unwrapLazyRnValue(module.exports[name]);
        if (prop === Symbol.toPrimitive) return () => value;
        if (value == null) {
          if (prop === 'create') return (input) => input;
          return undefined;
        }
        if (typeof value === 'string') {
          if (prop === 'prototype') return undefined;
          return undefined;
        }
        if (prop === 'prototype') return value.prototype;
        const inner = value[prop];
        if (typeof inner === 'function') return inner.bind(value);
        if (prop === 'create') return (input) => input;
        return inner;
      },
      apply(_target, thisArg, args) {
        const value = unwrapLazyRnValue(module.exports[name]);
        if (typeof value === 'function' && isRnCallableExport(name)) {
          return Reflect.apply(value, thisArg, args);
        }
        const React = require('react');
        const type =
          typeof value === 'function' || typeof value === 'string'
            ? value
            : 'View';
        return React.createElement(type, args[0] ?? null);
      },
    }
  );
}
export default module.exports;
`.trim();
