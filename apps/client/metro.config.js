// @ts-check
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch shared workspace packages for HMR (not the full monorepo — avoids watcher
//    crashes from backend dist artifacts and transient pnpm temp directories)
config.watchFolders = [
  path.resolve(monorepoRoot, 'libs'),
  path.resolve(monorepoRoot, 'apps'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// 3. Follow pnpm symlinks (always-on in Metro 0.81+) and enable package exports
// @ts-ignore
config.resolver.unstable_enablePackageExports = true;

// 4. Normalize HMR entry-point URLs from the web dev client.
//    The browser sends its current page URL (e.g.
//    `http://localhost:5173/more/server-status?platform=web`) to Metro's
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

// Cross-origin isolation so `SharedArrayBuffer` exists in the app + workers.
// absurd-sql needs it; without SAB it uses fragile IndexedDB fallback and can throw
// "Fallback mode unable to write file changes" on writes.
// https://github.com/jlongster/absurd-sql#requirements — use `require-corp` (not
// `credentialless`) so isolation matches what sql.js/absurd-sql expect in practice.
// @ts-ignore
config.server.enhanceMiddleware = (
  /** @type {(arg0: any, arg1: any, arg2: any) => void} */ middleware
) => {
  return (
    /** @type {any} */ req,
    /** @type {{ setHeader: (arg0: string, arg1: string) => void; }} */ res,
    /** @type {any} */ next
  ) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = config;
