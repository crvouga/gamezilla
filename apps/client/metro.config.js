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
//    The browser sends its page URL (e.g. `http://localhost:8082/?platform=web`) to
//    Metro's HmrServer. That URL has an empty path but a query string, which
//    `jsc-safe-url.toJscSafeUrl` rejects with:
//      "The given URL ... has an empty path and cannot be converted to a JSC-safe format."
//    HmrServer runs `config.server.rewriteRequestUrl` before parsing, so rewrite
//    empty-path URLs to the project entry. Because `unstable_serverRoot` is the
//    monorepo root in Expo's config, the bundle path must include the client
//    sub-path (e.g. `/apps/client/index.bundle`).
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

/** @param {string} url */
function normalizeEmptyPathUrl(url) {
  if (typeof url !== 'string') {
    return url;
  }
  try {
    const hasAbsoluteProtocol =
      url.startsWith('http://') || url.startsWith('https://');
    const parsed = hasAbsoluteProtocol
      ? new URL(url)
      : new URL(url, 'http://hmr.local');
    const emptyPath = parsed.pathname === '' || parsed.pathname === '/';
    if (emptyPath && parsed.search.length > 1) {
      parsed.pathname = entryBundlePath;
      if (hasAbsoluteProtocol) {
        return parsed.toString();
      }
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // Malformed URL — let Metro surface the original error.
  }
  return url;
}

config.server.rewriteRequestUrl = (/** @type {string} */ url) =>
  previousRewrite(normalizeEmptyPathUrl(url));

// Add wasm asset support
config.resolver.assetExts.push('wasm');

// Add COEP and COOP headers to support SharedArrayBuffer
// @ts-ignore
config.server.enhanceMiddleware = (
  /** @type {(arg0: any, arg1: any, arg2: any) => void} */ middleware
) => {
  return (
    /** @type {any} */ req,
    /** @type {{ setHeader: (arg0: string, arg1: string) => void; }} */ res,
    /** @type {any} */ next
  ) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    middleware(req, res, next);
  };
};

module.exports = config;
