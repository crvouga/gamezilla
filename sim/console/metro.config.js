// @ts-check
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot =
  typeof process.env.EXPO_METRO_PROJECT_ROOT === 'string' &&
  process.env.EXPO_METRO_PROJECT_ROOT.length > 0
    ? path.resolve(process.env.EXPO_METRO_PROJECT_ROOT)
    : __dirname;
const monorepoRoot = path.resolve(__dirname, '../..');

const config = getDefaultConfig(projectRoot);

// Expo defaults to os.tmpdir()/metro-cache, shared across projects. Clearing
// that store on every dev start (`expo start --clear`) races when another
// Metro process still holds files — ENOTEMPTY on macOS. Keep cache local and
// only clear via EXPO_DEV_CLEAR=1 (see scripts/metro-dev-cache.ts).
const { FileStore } = require(
  require.resolve('metro-cache', {
    paths: [require.resolve('expo/metro-config')],
  })
);
const metroCacheRoot = path.join(
  projectRoot,
  'node_modules',
  '.cache',
  'metro'
);
config.cacheStores = [new FileStore({ root: metroCacheRoot })];

// Watchman on `sim/console` when available (see setup-env.ts → EXPO_USE_WATCHMAN).
// Node crawl must not watch `node_modules` — Bun symlinks resolve into
// `node_modules/.bun` (~340k files) and hit EMFILE on macOS.
config.resolver = {
  ...config.resolver,
  useWatchman: process.env['EXPO_USE_WATCHMAN'] === '1',
};

// Workspace sources for HMR. With Watchman, also include the Bun store so Metro
// can SHA-1 deps resolved via `sim/console/node_modules` symlinks. Node crawl
// must never watch `node_modules` directly (symlinks fan out into `.bun`).
/** @type {string[]} */
const watchFolders = [
  path.resolve(monorepoRoot, 'apps'),
  path.resolve(monorepoRoot, 'libs'),
  path.resolve(monorepoRoot, 'pkgs'),
];
if (process.env['EXPO_USE_WATCHMAN'] === '1') {
  watchFolders.push(path.resolve(monorepoRoot, 'node_modules/.bun'));
}
config.watchFolders = watchFolders;

// `blockList` keeps native / build trees out of the Node watcher fallback.
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList)
    ? config.resolver.blockList
    : config.resolver.blockList
      ? [config.resolver.blockList]
      : []),
  /[/\\]apps[/\\]client[/\\]ios[/\\].*/,
  /[/\\]apps[/\\]client[/\\]android[/\\].*/,
  /[/\\]\.expo[/\\].*/,
  /[/\\]\.check-dist-dev[/\\].*/,
  /[/\\]\.check-native[/\\].*/,
];

// Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'apps/client/node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Follow pnpm symlinks (always-on in Metro 0.81+) and enable package exports
// @ts-ignore
config.resolver.unstable_enablePackageExports = true;

// Resolve RN-web export conditions for packages that ship dual entrypoints.
config.resolver.unstable_conditionsByPlatform = {
  ...config.resolver.unstable_conditionsByPlatform,
  web: [
    ...(config.resolver.unstable_conditionsByPlatform?.web ?? []),
    'react-native-web',
  ],
};

// 3a. Dedupe singletons-by-module-path to a single instance.
//     Bun's content-addressed deduper produces distinct physical paths for the
//     same version of a package across workspaces (e.g. `sim/console` vs
//     `{apps,libs,pkgs}/*`), which Metro treats as separate modules. For libraries that
//     keep singleton state in a module-level closure, that yields multiple
//     copies of the singleton — symptoms include:
//       - `@lingui/core` / `@lingui/react`: "Lingui: Attempted to call a
//         translation function without setting a locale." (the `i18n` activated
//         by `sim/console/src/i18n/i18n.ts` is a different object than the
//         one the `@lingui/core/macro` `t` template imports from inside
//         `{apps,libs,pkgs}/*`).
//       - `expo-router`: "Cannot read properties of undefined (reading
//         'isReady')" on any `router.push` called from a non-client workspace.
//         `<ExpoRoot>` (rendered from client) writes `navigationRef` into
//         client's copy of the global `storeRef`; `useRouter` imported from
//         another workspace reads from its own empty `storeRef`.
//     Pin all such imports to the client's resolution.
const dedupeAliasOrigin = path.join(projectRoot, 'package.json');
const dedupeAliasPrefixes = [
  '@gorhom/bottom-sheet',
  '@lingui/core',
  '@lingui/react',
  'react',
  'react-dom',
];
const clientPkgRequire = require('module').createRequire(dedupeAliasOrigin);
/** CanvasKit JS loader ABI must match the WASM copied in bundle-skia-canvaskit-wasm.ts. */
const skiaResolveOrigins = [
  dedupeAliasOrigin,
  path.join(monorepoRoot, 'apps/client/package.json'),
  path.join(monorepoRoot, 'pkgs/ui/package.json'),
];
let skiaWebOrigin = dedupeAliasOrigin;
for (const origin of skiaResolveOrigins) {
  try {
    const req = require('module').createRequire(origin);
    skiaWebOrigin = req.resolve(
      '@shopify/react-native-skia/lib/module/web/LoadSkiaWeb.js'
    );
    break;
  } catch {
    // Try next workspace that declares Skia.
  }
}
const skiaPinnedPrefixes = ['canvaskit-wasm'];
const fs = require('fs');
const useWatchman = process.env['EXPO_USE_WATCHMAN'] === '1';
const previousResolveRequest = config.resolver.resolveRequest;

/** Watchman indexes Bun store targets, not `sim/console/node_modules` symlink paths. */
function metroResolvedPath(filePath) {
  if (!useWatchman) {
    return filePath;
  }
  try {
    return fs.realpathSync(filePath);
  } catch {
    return filePath;
  }
}

/** Prefer `sim/console/node_modules` symlinks over Bun store realpaths for Watchman SHA-1. */
function resolveViaClientNodeModules(moduleName) {
  if (
    moduleName === 'canvaskit-wasm' ||
    moduleName.startsWith('canvaskit-wasm/')
  ) {
    return null;
  }
  const segments = moduleName.split('/');
  let pkgName;
  let subpath;
  if (moduleName.startsWith('@') && segments.length >= 2) {
    pkgName = `${segments[0]}/${segments[1]}`;
    subpath = segments.slice(2).join('/');
  } else if (moduleName.startsWith('@')) {
    return null;
  } else {
    pkgName = segments[0] ?? '';
    subpath = segments.slice(1).join('/');
  }
  if (pkgName.length === 0) return null;

  const base = path.join(projectRoot, 'node_modules', pkgName);
  if (!fs.existsSync(base)) return null;

  if (subpath.length === 0) {
    try {
      const pkgJsonPath = path.join(base, 'package.json');
      if (!fs.existsSync(pkgJsonPath)) return null;
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
      const main = pkg.main ?? 'index.js';
      if (typeof main !== 'string') return null;
      const mainPath = path.join(base, main);
      if (fs.existsSync(mainPath)) return mainPath;
    } catch {
      return null;
    }
    return null;
  }

  // Package exports (e.g. `hono/client` → dist/client) have no physical
  // `node_modules/<pkg>/<subpath>` file — resolve via Node from the client root.
  try {
    const filePath = clientPkgRequire.resolve(moduleName);
    if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
      return filePath;
    }
  } catch {
    // Fall through to physical path candidates.
  }

  const joined = path.join(base, subpath);
  const candidates = [
    joined,
    `${joined}.js`,
    `${joined}.tsx`,
    `${joined}.ts`,
    path.join(joined, 'index.js'),
    path.join(joined, 'index.tsx'),
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) continue;
    if (fs.statSync(candidate).isDirectory()) continue;
    return candidate;
  }
  return null;
}

function moduleNameFromBunStorePath(filePath) {
  const marker = `${path.sep}.bun${path.sep}`;
  const bunIdx = filePath.indexOf(marker);
  if (bunIdx === -1) return null;
  const afterStore = filePath.slice(bunIdx + marker.length);
  const nestedIdx = afterStore.indexOf(`${path.sep}node_modules${path.sep}`);
  if (nestedIdx === -1) return null;
  const rel = afterStore.slice(
    nestedIdx + `${path.sep}node_modules${path.sep}`.length
  );
  return rel.split(path.sep).join('/');
}

function normalizeResolvedPath(resolved) {
  if (resolved?.filePath == null) return resolved;
  if (resolved.filePath.includes(`${path.sep}canvaskit-wasm${path.sep}`)) {
    return resolved;
  }
  // Bun may resolve to either the client `node_modules` symlink or the
  // content-addressed `.bun` store path. Prefer the client symlink for
  // dedupe, then realpath back into `.bun` so Watchman (which indexes the
  // store, not the symlink path) can SHA-1 the file.
  const fromBun = moduleNameFromBunStorePath(resolved.filePath);
  const mapped = fromBun !== null ? resolveViaClientNodeModules(fromBun) : null;
  const candidate = mapped ?? resolved.filePath;
  return { ...resolved, filePath: metroResolvedPath(candidate) };
}

/** Bun store symlinks are invisible to Watchman crawls; Node resolution still works. */
function resolveOrigins(context) {
  /** @type {string[]} */
  const origins = [];
  const seeds = [context?.originModulePath, dedupeAliasOrigin].filter(
    (origin) => typeof origin === 'string' && origin.length > 0
  );
  for (const origin of seeds) {
    if (!origins.includes(origin)) {
      origins.push(origin);
    }
    try {
      const real = fs.realpathSync(origin);
      if (!origins.includes(real)) {
        origins.push(real);
      }
    } catch {
      // Ignore broken symlinks — try the next seed.
    }
  }
  return origins;
}

function resolveWithNodeRequire(context, moduleName) {
  const viaClient = resolveViaClientNodeModules(moduleName);
  if (viaClient !== null) {
    return { filePath: metroResolvedPath(viaClient), type: 'sourceFile' };
  }
  for (const origin of resolveOrigins(context)) {
    try {
      const req = require('module').createRequire(origin);
      const filePath = req.resolve(moduleName);
      // Node built-ins (e.g. `buffer`) resolve to a bare id, not a file path.
      if (!path.isAbsolute(filePath) || !fs.existsSync(filePath)) {
        continue;
      }
      const mapped = resolveViaClientNodeModules(
        moduleNameFromBunStorePath(filePath) ?? moduleName
      );
      if (mapped !== null) {
        return { filePath: metroResolvedPath(mapped), type: 'sourceFile' };
      }
      return { filePath: metroResolvedPath(filePath), type: 'sourceFile' };
    } catch {
      // Try the next origin (symlink vs Bun store realpath).
    }
  }
  return null;
}

// @ts-ignore
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const matchesDedupeAlias = dedupeAliasPrefixes.some(
    (prefix) => moduleName === prefix || moduleName.startsWith(prefix + '/')
  );
  const matchesSkiaPinned = skiaPinnedPrefixes.some(
    (prefix) => moduleName === prefix || moduleName.startsWith(prefix + '/')
  );
  if (matchesSkiaPinned) {
    const aliasContext = { ...context, originModulePath: skiaWebOrigin };
    try {
      let resolved;
      if (typeof previousResolveRequest === 'function') {
        resolved = previousResolveRequest(aliasContext, moduleName, platform);
      } else {
        resolved = aliasContext.resolveRequest(
          aliasContext,
          moduleName,
          platform
        );
      }
      if (resolved != null) return normalizeResolvedPath(resolved);
    } catch (err) {
      const nodeResult = resolveWithNodeRequire(aliasContext, moduleName);
      if (nodeResult !== null) return nodeResult;
      throw err;
    }
    const nodeResult = resolveWithNodeRequire(aliasContext, moduleName);
    if (nodeResult !== null) return nodeResult;
    return null;
  }
  if (matchesDedupeAlias) {
    const viaClient = resolveViaClientNodeModules(moduleName);
    if (viaClient !== null) {
      return { filePath: metroResolvedPath(viaClient), type: 'sourceFile' };
    }
    const aliasContext = { ...context, originModulePath: dedupeAliasOrigin };
    let resolved;
    if (typeof previousResolveRequest === 'function') {
      resolved = previousResolveRequest(aliasContext, moduleName, platform);
    } else {
      resolved = aliasContext.resolveRequest(
        aliasContext,
        moduleName,
        platform
      );
    }
    if (resolved != null) return normalizeResolvedPath(resolved);
    return resolved;
  }
  try {
    let resolved;
    if (typeof previousResolveRequest === 'function') {
      resolved = previousResolveRequest(context, moduleName, platform);
    } else {
      resolved = context.resolveRequest(context, moduleName, platform);
    }
    if (resolved != null) return normalizeResolvedPath(resolved);
  } catch (err) {
    const nodeResult = resolveWithNodeRequire(context, moduleName);
    if (nodeResult !== null) return nodeResult;
    throw err;
  }
  const nodeResult = resolveWithNodeRequire(context, moduleName);
  if (nodeResult !== null) return nodeResult;
  return null;
};

// 4. Normalize HMR entry-point URLs from the web dev client.
//    The browser sends its current page URL (e.g.
//    `http://localhost:5174/more/server-status?platform=web`) to Metro's
//    HmrServer when registering an entry point. Two failure modes arise:
//      a) Empty path (`/?platform=web`) — `jsc-safe-url.toJscSafeUrl` rejects
//         with "empty path cannot be converted to a JSC-safe format".
//      b) Non-empty SPA route path (`/more/server-status?platform=web`) —
//         Metro tries to resolve that path as a module from the server root
//         (the monorepo root, per Expo's `unstable_serverRoot`), producing
//         "Unable to resolve module ./more/server-status from /.../.".
//    Both are variants of the same bug: the HMR client conflates page URL
//    with bundle URL. Any URL carrying a `platform` query that is not a
//    `.bundle` path is an HMR entry-point URL for the SPA — rewrite it to
//    the project's entry bundle.
config.server = config.server ?? {};
const serverRoot = config.server.unstable_serverRoot ?? monorepoRoot;
const entryBundlePath =
  '/' +
  path
    .relative(serverRoot, path.join(projectRoot, 'index'))
    .split(path.sep)
    .join('/') +
  '.bundle';

const previousRewrite =
  typeof config.server.rewriteRequestUrl === 'function'
    ? config.server.rewriteRequestUrl.bind(config.server)
    : (/** @type {string} */ url) => url;

/** @param {string} pathname */
function isBundleLikePathname(pathname) {
  return (
    pathname.endsWith('.bundle') ||
    pathname.endsWith('.map') ||
    pathname.endsWith('.hmr')
  );
}

/** @param {string} url */
function normalizeHmrEntryUrl(url) {
  if (typeof url !== 'string') {
    return url;
  }
  try {
    const hasAbsoluteProtocol =
      url.startsWith('http://') || url.startsWith('https://');
    const parsed = hasAbsoluteProtocol
      ? new URL(url)
      : new URL(url, 'http://hmr.local');

    const hasPlatform = parsed.searchParams.has('platform');
    if (!hasPlatform) {
      return url;
    }
    if (isBundleLikePathname(parsed.pathname)) {
      return url;
    }

    parsed.pathname = entryBundlePath;
    if (hasAbsoluteProtocol) {
      return parsed.toString();
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    // Malformed URL — let Metro surface the original error.
    return url;
  }
}

config.server.rewriteRequestUrl = (/** @type {string} */ url) =>
  previousRewrite(normalizeHmrEntryUrl(url));

// Add wasm asset support
config.resolver.assetExts.push('wasm');
if (!config.resolver.sourceExts.includes('mjs')) {
  config.resolver.sourceExts.push('mjs');
}

// expo-sqlite on web needs wasm assets (above) and cross-origin isolation so
// SharedArrayBuffer is available to the expo-sqlite worker.
// https://docs.expo.dev/versions/latest/sdk/sqlite/#web-setup
const {
  applyExpoSqliteWebIsolationHeaders,
} = require('./scripts/expo-sqlite-web-headers.js');
// @ts-ignore
config.server.enhanceMiddleware = (
  /** @type {(arg0: any, arg1: any, arg2: any) => void} */ middleware
) => {
  return (
    /** @type {any} */ req,
    /** @type {{ setHeader: (arg0: string, arg1: string) => void; }} */ res,
    /** @type {any} */ next
  ) => {
    applyExpoSqliteWebIsolationHeaders(res);
    middleware(req, res, next);
  };
};

module.exports = config;
