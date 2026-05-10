// @ts-check
const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

/** Root of installed `jotai` (CommonJS `.js` shims at package root). */
const jotaiPackageRoot = path.dirname(
  require.resolve('jotai/package.json', { paths: [projectRoot] })
);

/**
 * Metro's `unstable_enablePackageExports` can pick the ESM build (`esm/*.mjs`),
 * which references `import.meta.env` (Vite). Hermes web bundles run as a
 * classic script, so that throws "Cannot use 'import.meta' outside a module".
 * Force the published CJS entry files instead.
 *
 * @param {string} moduleName
 * @returns {string | null}
 */
function resolveJotaiPackageToCjsFile(moduleName) {
  if (moduleName === 'jotai') {
    return path.join(jotaiPackageRoot, 'index.js');
  }
  const prefix = 'jotai/';
  if (!moduleName.startsWith(prefix)) {
    return null;
  }
  const sub = moduleName.slice(prefix.length);
  const asFile = path.join(jotaiPackageRoot, `${sub}.js`);
  if (fs.existsSync(asFile)) {
    return asFile;
  }
  const asIndex = path.join(jotaiPackageRoot, sub, 'index.js');
  if (fs.existsSync(asIndex)) {
    return asIndex;
  }
  return null;
}

/**
 * When `unstable_enablePackageExports` resolves the `import` condition, Metro
 * may pass an absolute path under `.../jotai/esm/*.mjs` instead of the bare
 * specifier `jotai/...`. Map those to the sibling CJS tree at package root.
 *
 * @param {string} moduleName
 * @returns {string | null}
 */
function resolveJotaiEsmAbsolutePathToCjs(moduleName) {
  const normalized = moduleName.replace(/\\/g, '/');
  const marker = '/jotai/esm/';
  const idx = normalized.indexOf(marker);
  if (idx === -1) {
    return null;
  }
  const rel = normalized.slice(idx + marker.length);
  const asJs = rel.replace(/\.mjs$/i, '.js');
  const candidate = path.join(jotaiPackageRoot, asJs);
  if (fs.existsSync(candidate)) {
    return candidate;
  }
  const asIndex = path.join(
    jotaiPackageRoot,
    rel.replace(/\.mjs$/i, ''),
    'index.js'
  );
  if (fs.existsSync(asIndex)) {
    return asIndex;
  }
  return null;
}

const config = getDefaultConfig(projectRoot);

// 1. Watch shared workspace packages for HMR (not the full monorepo — avoids watcher
//    crashes from backend dist artifacts and transient pnpm temp directories)
config.watchFolders = [
  path.resolve(monorepoRoot, 'packages'),
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

// 3a. Dedupe `@lingui/core` and `@lingui/react` to a single instance.
//     Bun's content-addressed deduper produces distinct physical paths for the
//     same lingui version across workspaces (e.g. `packages/client` vs `packages/*`),
//     which Metro treats as separate modules. That yields multiple `i18n`
//     singletons: `packages/client/src/i18n/i18n.ts` activates one, but the
//     `@lingui/core/macro` `t` template (auto-injected `import { i18n } from
//     '@lingui/core'`) inside `packages/*` resolves to a different copy — whose
//     singleton is never activated, causing
//     "Lingui: Attempted to call a translation function without setting a locale."
//     Pin all lingui imports to the client's resolution.
const linguiAliasOrigin = path.join(projectRoot, 'package.json');
const linguiAliasPrefixes = ['@lingui/core', '@lingui/react'];
const previousResolveRequest = config.resolver.resolveRequest;
// @ts-ignore
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const jotaiCjs =
    typeof moduleName === 'string'
      ? (resolveJotaiPackageToCjsFile(moduleName) ??
        resolveJotaiEsmAbsolutePathToCjs(moduleName))
      : null;
  if (jotaiCjs !== null) {
    return { type: 'sourceFile', filePath: jotaiCjs };
  }
  const matchesLinguiAlias = linguiAliasPrefixes.some(
    (prefix) => moduleName === prefix || moduleName.startsWith(prefix + '/')
  );
  if (matchesLinguiAlias) {
    const aliasContext = { ...context, originModulePath: linguiAliasOrigin };
    if (typeof previousResolveRequest === 'function') {
      return previousResolveRequest(aliasContext, moduleName, platform);
    }
    return aliasContext.resolveRequest(aliasContext, moduleName, platform);
  }
  if (typeof previousResolveRequest === 'function') {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

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
