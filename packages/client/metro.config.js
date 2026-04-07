const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Resolve @/ and @gamezilla/* workspace imports directly to source files.
// This bypasses package.json "exports" maps which break Metro (Metro resolves
// the catch-all "./*":"./src/*" to a path without a file extension, then fails).
// Also handles the @/ alias here instead of tsconfig because Bun has a bug
// that silently drops child tsconfig paths when `extends` is used.
const srcDir = path.resolve(projectRoot, 'src');
const workspacePackages = {
  '@gamezilla/shared': path.resolve(monorepoRoot, 'packages/shared/src'),
  '@gamezilla/patch-db': path.resolve(monorepoRoot, 'packages/patch-db/src'),
  '@gamezilla/peer-store': path.resolve(monorepoRoot, 'packages/peer-store/src'),
  '@gamezilla/patch-db-app': path.resolve(monorepoRoot, 'packages/patch-db-app/src'),
  '@gamezilla/peer-store-app': path.resolve(monorepoRoot, 'packages/peer-store-app/src'),
};
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('@/')) {
    return context.resolveRequest(
      context,
      path.resolve(srcDir, moduleName.slice(2)),
      platform,
    );
  }
  for (const [pkg, pkgSrcDir] of Object.entries(workspacePackages)) {
    if (moduleName.startsWith(pkg + '/')) {
      return context.resolveRequest(
        context,
        path.resolve(pkgSrcDir, moduleName.slice(pkg.length + 1)),
        platform,
      );
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

// expo-sqlite web: support wasm files
config.resolver.assetExts.push('wasm');

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
