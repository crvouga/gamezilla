const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

const expoVirtualEnvModulePath = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/expo/virtual/env.js')
);
const expoVirtualEnvDir = path.dirname(expoVirtualEnvModulePath);
const reactModulePath = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/react/index.js')
);
const reactJsxRuntimePath = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/react/jsx-runtime.js')
);
const reactJsxDevRuntimePath = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/react/jsx-dev-runtime.js')
);
const reactDomModulePath = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/react-dom/index.js')
);
const reactDomClientModulePath = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/react-dom/client.js')
);
const reactNativeWebModulePath = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/react-native-web/dist/cjs/index.js')
);
const reactNativeSafeAreaContextPath = fs.realpathSync(
  path.resolve(projectRoot, 'node_modules/react-native-safe-area-context')
);
const reactNativeSafeAreaContextIndexPath = fs.realpathSync(
  path.join(reactNativeSafeAreaContextPath, 'lib/module/index.js')
);

config.watchFolders = [monorepoRoot, expoVirtualEnvDir];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  expo: path.resolve(projectRoot, 'node_modules/expo'),
  react: path.resolve(projectRoot, 'node_modules/react'),
  'react-dom': path.resolve(projectRoot, 'node_modules/react-dom'),
  'react-native-web': path.resolve(
    projectRoot,
    'node_modules/react-native-web'
  ),
  // One copy so SafeAreaProvider (app root) matches useSafeAreaInsets (@gamezilla/shared).
  'react-native-safe-area-context': reactNativeSafeAreaContextPath,
};

// Resolve @gamezilla/client/ and @gamezilla/* workspace imports directly to source files.
// This bypasses package.json "exports" maps which break Metro (Metro resolves
// the catch-all "./*":"./src/*" to a path without a file extension, then fails).
// Also handles the @gamezilla/client/ alias here instead of tsconfig because Bun has a bug
// that silently drops child tsconfig paths when `extends` is used.
const srcDir = path.resolve(projectRoot, 'src');
const workspacePackages = {
  '@gamezilla/shared': path.resolve(monorepoRoot, 'libs/shared/src'),
  '@gamezilla/patch-db': path.resolve(monorepoRoot, 'libs/patch-db/src'),
  '@gamezilla/peer-store': path.resolve(monorepoRoot, 'libs/peer-store/src'),
  '@gamezilla/patch-db-example': path.resolve(
    monorepoRoot,
    'libs/patch-db-example/src'
  ),
  '@gamezilla/peer-store-example': path.resolve(
    monorepoRoot,
    'libs/peer-store-example/src'
  ),
};

/** Single module id for theme context so Metro never bundles two `createContext` instances. */
const sharedThemeContextPath = path.resolve(
  monorepoRoot,
  'libs/shared/src/ui/theme/theme-context.tsx'
);

function normalizeResolvedThemeContext(result) {
  if (
    result &&
    result.type === 'sourceFile' &&
    typeof result.filePath === 'string' &&
    result.filePath
      .replace(/\\/g, '/')
      .endsWith('libs/shared/src/ui/theme/theme-context.tsx')
  ) {
    return { ...result, filePath: sharedThemeContextPath };
  }
  return result;
}

/** Compare paths; realpath avoids symlink mismatch vs `originModulePath`. */
function isUnderMonorepoRoot(originModulePath) {
  if (!originModulePath) {
    return false;
  }
  try {
    return (
      fs.realpathSync(path.resolve(originModulePath)) ===
      fs.realpathSync(monorepoRoot)
    );
  } catch {
    return path.resolve(originModulePath) === path.resolve(monorepoRoot);
  }
}

/**
 * Metro sometimes resolves relative route imports with `originModulePath` at the
 * monorepo root (e.g. HMR + watchFolders). Then `./profile/avatar` becomes
 * `<repo>/profile/avatar` and fails. Rewire to `src/app/(tabs)/…` or `src/app/…`.
 */
function tryResolveRelativeFromMonorepoRoot(context, moduleName, platform) {
  if (
    !moduleName.startsWith('./') ||
    !isUnderMonorepoRoot(context.originModulePath)
  ) {
    return null;
  }
  const rel = moduleName.slice(2);
  const candidates = [
    path.join(projectRoot, 'src/app/(tabs)', rel),
    path.join(projectRoot, 'src/app', rel),
  ];
  for (const base of candidates) {
    try {
      const result = context.resolveRequest(context, base, platform);
      if (result && result.type === 'sourceFile') {
        return result;
      }
    } catch {
      // try next candidate
    }
  }
  return null;
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const finish = (result) => normalizeResolvedThemeContext(result);
  const fromRoot = tryResolveRelativeFromMonorepoRoot(
    context,
    moduleName,
    platform
  );
  if (fromRoot) {
    return finish(fromRoot);
  }
  if (moduleName === 'expo/virtual/env') {
    return finish({
      type: 'sourceFile',
      filePath: expoVirtualEnvModulePath,
    });
  }
  if (moduleName === 'react') {
    return finish({ type: 'sourceFile', filePath: reactModulePath });
  }
  if (moduleName === 'react/jsx-runtime') {
    return finish({ type: 'sourceFile', filePath: reactJsxRuntimePath });
  }
  if (moduleName === 'react/jsx-dev-runtime') {
    return finish({ type: 'sourceFile', filePath: reactJsxDevRuntimePath });
  }
  if (moduleName === 'react-dom') {
    return finish({ type: 'sourceFile', filePath: reactDomModulePath });
  }
  if (moduleName === 'react-dom/client') {
    return finish({ type: 'sourceFile', filePath: reactDomClientModulePath });
  }
  if (moduleName === 'react-native' && platform === 'web') {
    return finish({ type: 'sourceFile', filePath: reactNativeWebModulePath });
  }
  if (moduleName === 'react-native-safe-area-context') {
    return finish({
      type: 'sourceFile',
      filePath: reactNativeSafeAreaContextIndexPath,
    });
  }
  if (moduleName.startsWith('@gamezilla/client/')) {
    return finish(
      context.resolveRequest(
        context,
        path.resolve(srcDir, moduleName.slice(2)),
        platform
      )
    );
  }
  for (const [pkg, pkgSrcDir] of Object.entries(workspacePackages)) {
    if (moduleName.startsWith(pkg + '/')) {
      return finish(
        context.resolveRequest(
          context,
          path.resolve(pkgSrcDir, moduleName.slice(pkg.length + 1)),
          platform
        )
      );
    }
  }
  return finish(context.resolveRequest(context, moduleName, platform));
};

// expo-sqlite web: support wasm files
config.resolver.assetExts.push('wasm');

/**
 * Metro 0.83+ passes HMR bundle URLs through `jsc-safe-url`, which throws when
 * the path is only `/` (or empty) but a query string exists — e.g.
 * `http://localhost:5173/?platform=web` from the web dev client. Normalize to
 * `/index.bundle` so parsing matches the app entry (`package.json` `main`).
 */
function fixHmrEmptyPathUrl(url) {
  if (typeof url !== 'string') {
    return url;
  }
  try {
    const parsed =
      url.startsWith('http://') || url.startsWith('https://')
        ? new URL(url)
        : new URL(url, 'http://hmr.local');
    const emptyPath = parsed.pathname === '' || parsed.pathname === '/';
    if (emptyPath && parsed.search.length > 1) {
      parsed.pathname = '/index.bundle';
      if (url.startsWith('http://') || url.startsWith('https://')) {
        return parsed.toString();
      }
      return parsed.pathname + parsed.search + parsed.hash;
    }
  } catch {
    // ignore malformed URLs
  }
  return url;
}

if (typeof config.server?.rewriteRequestUrl === 'function') {
  const previousRewrite = config.server.rewriteRequestUrl.bind(config.server);
  config.server.rewriteRequestUrl = (url) =>
    previousRewrite(fixHmrEmptyPathUrl(url));
}

// expo-sqlite web: COEP/COOP headers for SharedArrayBuffer
config.server = config.server ?? {};
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    return middleware(req, res, next);
  };
};

module.exports = config;
