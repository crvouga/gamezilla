/**
 * Which files the bun:test Babel plugin should transform (Expo preset +
 * Lingui). Skip test files so bun:test can register them natively. Transform
 * workspace app sources and, in node_modules, only RN packages whose published
 * entry is Flow or ESM that bun cannot load as-is.
 */
import { readFileSync } from 'node:fs';
import { dirname, sep } from 'node:path';
import { rewriteRnPlatformSpecifiers } from './bun-rn-platform-resolve';
import {
  REACT_NATIVE_INDEX_HELPERS,
  REACT_NATIVE_INDEX_TAIL,
  REACT_NATIVE_NON_VIRTUALIZING_LIST,
} from './react-native-index-runtime';

/** Expo/RN presets pull unicode-regex → regenerate; bun:test has two regenerate copies. */
function stubBabelUnicodeRegexPlugin(): void {
  const noop = Object.assign(() => ({ visitor: {} }), {
    default: () => ({ visitor: {} }),
  });
  const fromIds = [
    () => require.resolve('@babel/plugin-transform-unicode-regex'),
    () =>
      require.resolve('@babel/plugin-transform-unicode-regex', {
        paths: [dirname(require.resolve('expo/internal/babel-preset'))],
      }),
  ];
  for (const resolveId of fromIds) {
    try {
      const filename = resolveId();
      require.cache[filename] = {
        id: filename,
        filename,
        loaded: true,
        exports: noop,
        children: [],
        paths: [],
      } as unknown as NodeModule;
    } catch {
      // unicode-regex is not in this install graph
    }
  }
}

stubBabelUnicodeRegexPlugin();

const NODE_MODULES_SEG = `${sep}node_modules${sep}`;

const SKIP_SUFFIXES = [
  'bun-preload.ts',
  'bun-babel-plugin.ts',
  'bun-rn-transform.ts',
  'babel.test.config.cjs',
];

const NODE_MODULES_ALLOW = [
  /(?:^|[/\\])react-native[/\\]/,
  /(?:^|[/\\])@react-native(?:-community)?[/\\]/,
  /(?:^|[/\\])expo(?:nent)?/,
  /(?:^|[/\\])@expo(?:nent)?[/\\]/,
  /(?:^|[/\\])@expo-google-fonts[/\\]/,
  /(?:^|[/\\])@react-navigation[/\\]/,
  /(?:^|[/\\])react-native-/,
  /(?:^|[/\\])@testing-library[/\\]react-native[/\\]/,
  /(?:^|[/\\])@gorhom[/\\]/,
  /(?:^|[/\\])lucide-react-native[/\\]/,
  /(?:^|[/\\])@shopify[/\\]react-native-skia[/\\]/,
];

export function bunTestFileLoader(
  filePath: string
): 'js' | 'jsx' | 'ts' | 'tsx' {
  if (filePath.endsWith('.tsx')) return 'tsx';
  if (filePath.endsWith('.ts')) return 'ts';
  if (filePath.endsWith('.jsx')) return 'jsx';
  return 'js';
}

/**
 * RN's index.js is Flow + CJS getters. Expo emits CJS. Re-export names as
 * lazy proxies so `import { Appearance }` works without running every getter.
 */
const REACT_NATIVE_HOST_TYPES: Record<string, string> = {
  View: 'View',
  Text: 'Text',
  ScrollView: 'RCTScrollView',
  TextInput: 'TextInput',
  Image: 'Image',
  KeyboardAvoidingView: 'View',
  TouchableNativeFeedback: 'View',
  TouchableHighlight: 'View',
  TouchableOpacity: 'View',
  TouchableWithoutFeedback: 'View',
  Switch: 'View',
  DrawerLayoutAndroid: 'View',
};

const REACT_NATIVE_VALUE_EXPORTS = new Set([
  'FlatList',
  'SectionList',
  'Pressable',
  'Dimensions',
  'Appearance',
  'NativeModules',
  'Platform',
]);

function namedReactNativeExports(names: string[]): string {
  return names
    .map((name) => {
      if (REACT_NATIVE_HOST_TYPES[name] != null) {
        return `export const ${name} = ${JSON.stringify(REACT_NATIVE_HOST_TYPES[name])};`;
      }
      if (REACT_NATIVE_VALUE_EXPORTS.has(name)) {
        return `export const ${name} = module.exports[${JSON.stringify(name)}];`;
      }
      return `export const ${name} = lazyExport(${JSON.stringify(name)});`;
    })
    .join('\n');
}

function assignCjsHostTypes(): string {
  return Object.entries(REACT_NATIVE_HOST_TYPES)
    .map(
      ([
        name,
        host,
      ]) => `Object.defineProperty(module.exports, ${JSON.stringify(name)}, {
  configurable: true,
  enumerable: true,
  writable: true,
  value: ${JSON.stringify(host)},
});`
    )
    .join('\n');
}

export function wrapReactNativeIndexCjs(cjs: string, filePath: string): string {
  const normalized = filePath.replaceAll('\\', '/');
  if (!normalized.endsWith('/react-native/index.js')) return cjs;
  const names = [
    ...new Set(
      [...cjs.matchAll(/\bget ([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1])
    ),
  ].filter((name): name is string => name != null && name !== 'default');
  return `import { createRequire } from 'node:module';
const require = createRequire(${JSON.stringify(filePath)});
${REACT_NATIVE_INDEX_HELPERS}
const module = { exports: {} };
const exports = module.exports;
(function (require, module, exports) {
${cjs}
})(interopRequire, module, exports);
${assignCjsHostTypes()}
${REACT_NATIVE_NON_VIRTUALIZING_LIST}
${REACT_NATIVE_INDEX_TAIL}
${namedReactNativeExports(names)}
`;
}

/**
 * Only the package's own sources — not nested copies of `@babel/*` inside
 * `react-native-*` bun install folders (those must load as real ESM plugins).
 */
export const RN_NODE_MODULE_FILTER =
  /\/node_modules\/(?:react-native\/|@shopify\/react-native-skia\/).+\.(?:js|jsx|ts|tsx)$/;

/** Workspace sources that use Lingui macros / RN JSX. */
export const WORKSPACE_TSX_FILTER =
  /\/(apps|libs|product)\/.*\.[jt]sx?$|\/pkgs\/(?:chess-board|ui-rn|room-widgets)\/src\/.*\.[jt]sx?$/;

export const MEDIA_ASSET_FILTER =
  /\.(?:mp3|wav|m4a|png|jpe?g|gif|webp|svg|ttf|otf|woff2?)$/;

export function bunMediaAssetModule(): { contents: string; loader: 'js' } {
  return { contents: 'export default 1;', loader: 'js' };
}

export function babelRnTestCaller(
  keepEsm: boolean,
  scope: 'workspace' | 'node_modules' = 'workspace'
): {
  name: string;
  bundler: string;
  platform: string;
  keepEsm: boolean;
} {
  return {
    name: scope === 'node_modules' ? 'babel-jest-rn-nm' : 'babel-jest',
    bundler: 'jest',
    platform: 'ios',
    keepEsm,
  };
}

function parserOptsForRnTestFile(filePath: string): {
  plugins: Array<string | [string, object]>;
} {
  if (filePath.includes(NODE_MODULES_SEG)) {
    return { plugins: ['flow', 'jsx'] };
  }
  if (filePath.endsWith('.ts')) {
    return { plugins: ['typescript', 'explicitResourceManagement'] };
  }
  return { plugins: ['typescript', 'jsx', 'explicitResourceManagement'] };
}

function loadWorkspaceBabelConfig(
  configFile: string,
  keepEsm: boolean
): { presets?: unknown[]; plugins?: unknown[] } {
  const loaded = require(configFile) as
    | ((api: object) => { presets?: unknown[]; plugins?: unknown[] })
    | {
        default: (api: object) => { presets?: unknown[]; plugins?: unknown[] };
      };
  const factory = typeof loaded === 'function' ? loaded : loaded.default;
  const cache = Object.assign((fn?: () => string) => fn?.(), {
    using: (fn: () => string) => fn(),
  });
  return factory({
    caller: (cb: (c: { keepEsm: boolean }) => unknown) => cb({ keepEsm }),
    cache,
  });
}

function isReactNativeIndex(filePath: string): boolean {
  return filePath.replaceAll('\\', '/').endsWith('/react-native/index.js');
}

function expoBabelPlugin(id: string): unknown {
  return require.resolve(id, {
    paths: [dirname(require.resolve('expo/internal/babel-preset'))],
  });
}

function flowStripPlugin(): unknown {
  return expoBabelPlugin('@babel/plugin-transform-flow-strip-types');
}

function hermesParserPlugin(): unknown {
  return expoBabelPlugin('babel-plugin-syntax-hermes-parser');
}

type BabelCore = {
  transformSync: (
    code: string,
    opts: object
  ) => { code?: string | null } | null;
  transformFileSync: (
    file: string,
    opts: object
  ) => { code?: string | null } | null;
};

function loadBabel(): BabelCore {
  return require('@babel/core') as BabelCore;
}

/** Flow + Hermes `component` + JSX, without Expo's unicode-regex plugin. */
function rnNodeModuleBabelPlugins(): unknown[] {
  return [
    [
      hermesParserPlugin(),
      { parseLangTypes: 'flow', reactRuntimeTarget: '19' },
    ],
    [flowStripPlugin(), { all: true }],
    [
      expoBabelPlugin('@babel/plugin-transform-react-jsx'),
      { runtime: 'automatic' },
    ],
  ];
}

/** Strip Flow without Expo's unicode-regex preset (breaks under bun:test). */
function stripFlowFromRnIndex(filePath: string): string {
  const source = rewriteRnPlatformSpecifiers(
    readFileSync(filePath, 'utf8')
      .replace(/import typeof \* as \w+ from '[^']+';\n/g, '')
      .replace(/\} as \w+;/g, '};'),
    filePath
  );
  const result = loadBabel().transformSync(source, {
    filename: filePath,
    babelrc: false,
    configFile: false,
    parserOpts: { plugins: ['flow', 'jsx'] },
    plugins: [[flowStripPlugin(), { all: true }]],
  });
  return result?.code ?? source;
}

function turboModuleRegistryStub(): string {
  return `
const PLATFORM_CONSTANTS = {
  isTesting: true,
  forceTouchAvailable: false,
  osVersion: '17.0',
  systemName: 'iOS',
  interfaceIdiom: 'phone',
  reactNativeVersion: { major: 0, minor: 83, patch: 10, prerelease: null },
};
export function get(name) {
  if (name === 'PlatformConstants') {
    return { getConstants: () => PLATFORM_CONSTANTS };
  }
  return { getConstants: () => ({}) };
}
export function getEnforcing(name) {
  return get(name);
}
export default { get, getEnforcing };
`;
}

function viewConfigRegistryStub(): string {
  return `
export const customDirectEventTypes = {};
export const customBubblingEventTypes = {};
export function register(name) {
  return name;
}
export default { customDirectEventTypes, customBubblingEventTypes, register };
`;
}

function nativeComponentRegistryStub(): string {
  return `
export function get(name) {
  return name;
}
export function getWithFallback_DEPRECATED(name) {
  return name;
}
export default { get, getWithFallback_DEPRECATED };
`;
}

function rnHarnessModuleStub(filePath: string): string | undefined {
  const posix = filePath.replaceAll('\\', '/');
  if (posix.endsWith('/Libraries/TurboModule/TurboModuleRegistry.js')) {
    return turboModuleRegistryStub();
  }
  if (posix.endsWith('/Libraries/Utilities/Dimensions.js')) {
    return dimensionsStub();
  }
  if (posix.endsWith('/Renderer/shims/ReactNativeViewConfigRegistry.js')) {
    return viewConfigRegistryStub();
  }
  if (posix.endsWith('/NativeComponent/NativeComponentRegistry.js')) {
    return nativeComponentRegistryStub();
  }
  return undefined;
}

function dimensionsStub(): string {
  return `
const metrics = { width: 390, height: 844, scale: 3, fontScale: 1 };
const dimensions = { window: metrics, screen: metrics };
const Dimensions = {
  get: (dim) => dimensions[dim],
  set: (dims) => {
    if (dims?.window) dimensions.window = dims.window;
    if (dims?.screen) dimensions.screen = dims.screen;
  },
  addEventListener: () => ({ remove: () => undefined }),
  removeEventListener: () => undefined,
};
export default Dimensions;
`;
}

function transformRnNodeModule(filePath: string): string {
  const stub = rnHarnessModuleStub(filePath);
  if (stub != null) return stub;
  const source = rewriteRnPlatformSpecifiers(
    readFileSync(filePath, 'utf8'),
    filePath
  );
  const result = loadBabel().transformSync(source, {
    filename: filePath,
    babelrc: false,
    configFile: false,
    plugins: rnNodeModuleBabelPlugins(),
  });
  return result?.code ?? source;
}

/**
 * Workspace files use the package Babel config (Lingui, `using`, …).
 * `node_modules` get Hermes parser + Flow strip (no unicode-regex).
 */
export function babelTransformRnTestFile(args: {
  filePath: string;
  configFile: string;
  keepEsm: boolean;
}): { contents: string; loader: 'js' } {
  if (isReactNativeIndex(args.filePath)) {
    return {
      contents: wrapReactNativeIndexCjs(
        stripFlowFromRnIndex(args.filePath),
        args.filePath
      ),
      loader: 'js',
    };
  }
  const inNodeModules = args.filePath.includes(NODE_MODULES_SEG);
  if (inNodeModules) {
    return {
      contents: wrapReactNativeIndexCjs(
        transformRnNodeModule(args.filePath),
        args.filePath
      ),
      loader: 'js',
    };
  }
  const workspace = loadWorkspaceBabelConfig(args.configFile, args.keepEsm);
  const result = loadBabel().transformFileSync(args.filePath, {
    caller: babelRnTestCaller(args.keepEsm, 'workspace'),
    sourceMaps: 'inline',
    babelrc: false,
    configFile: false,
    parserOpts: parserOptsForRnTestFile(args.filePath),
    presets: workspace.presets,
    plugins: workspace.plugins,
  });
  return {
    contents: wrapReactNativeIndexCjs(
      result?.code ?? readFileSync(args.filePath, 'utf8'),
      args.filePath
    ),
    loader: 'js',
  };
}

export function shouldTransformRnTestFile(filePath: string): boolean {
  if (SKIP_SUFFIXES.some((s) => filePath.endsWith(s))) return false;
  if (filePath.endsWith('.cjs') || filePath.endsWith('.mjs')) return false;
  if (/\.test\.[jt]sx?$/.test(filePath)) return false;
  if (filePath.includes(`${sep}tests${sep}`)) return false;
  if (!filePath.includes(NODE_MODULES_SEG)) return true;
  return NODE_MODULES_ALLOW.some((re) => re.test(filePath));
}

/** CJS configs must use bun's default loader; skipped TS uses the native loader. */
export function workspaceRnTestOnLoad(
  filePath: string,
  transform: (path: string) => { contents: string; loader: 'js' }
): { contents: string; loader: 'js' | 'ts' | 'tsx' | 'jsx' } | undefined {
  if (!shouldTransformRnTestFile(filePath)) {
    return {
      contents: readFileSync(filePath, 'utf8'),
      loader: bunTestFileLoader(filePath),
    };
  }
  return transform(filePath);
}
