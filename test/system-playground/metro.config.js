/**
 * Minimal Metro config for the in-process system playground (Expo web).
 * Shims Node-only modules pulled transitively by `@apps/api` sim composition.
 */

// @ts-check
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');
const fs = require('node:fs');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');
const clientRoot = path.resolve(monorepoRoot, 'apps/client');

const config = getDefaultConfig(projectRoot);

const { FileStore } = require(
  require.resolve('metro-cache', {
    paths: [require.resolve('expo/metro-config')],
  })
);
config.cacheStores = [
  new FileStore({
    root: path.join(projectRoot, 'node_modules', '.cache', 'metro'),
  }),
];

config.watchFolders = [
  path.resolve(monorepoRoot, 'apps'),
  path.resolve(monorepoRoot, 'libs'),
  path.resolve(monorepoRoot, 'pkgs'),
  path.resolve(monorepoRoot, 'test'),
];

config.resolver = {
  ...config.resolver,
  useWatchman: process.env['EXPO_USE_WATCHMAN'] === '1',
  nodeModulesPaths: [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(clientRoot, 'node_modules'),
    path.resolve(monorepoRoot, 'node_modules'),
  ],
  unstable_enablePackageExports: true,
  unstable_conditionsByPlatform: {
    ...config.resolver.unstable_conditionsByPlatform,
    web: [
      ...(config.resolver.unstable_conditionsByPlatform?.web ?? []),
      'react-native-web',
    ],
  },
};

const emptyShim = path.join(projectRoot, 'metro-shims', 'empty.js');
/** Native / Node modules pulled by API composition that must not load in Expo web. */
const shimModules = new Set([
  'better-sqlite3',
  'pg',
  'pg-native',
  'bun:sqlite',
  'cloudflare:sockets',
  'fs',
  'node:fs',
  'fs/promises',
  'node:fs/promises',
  'child_process',
  'node:child_process',
  'net',
  'node:net',
  'tls',
  'node:tls',
  'dns',
  'node:dns',
  'worker_threads',
  'node:worker_threads',
]);

const previousResolveRequest = config.resolver.resolveRequest;
const clientRequire = require('module').createRequire(
  path.join(clientRoot, 'package.json')
);

const dedupePrefixes = [
  '@lingui/core',
  '@lingui/react',
  'react',
  'react-dom',
  'react-native',
  'react-native-web',
  'expo-sqlite',
];

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (shimModules.has(moduleName)) {
    return { type: 'sourceFile', filePath: emptyShim };
  }
  for (const prefix of dedupePrefixes) {
    if (moduleName === prefix || moduleName.startsWith(`${prefix}/`)) {
      try {
        const filePath = clientRequire.resolve(moduleName);
        if (path.isAbsolute(filePath) && fs.existsSync(filePath)) {
          return { type: 'sourceFile', filePath };
        }
      } catch {
        // fall through
      }
    }
  }
  if (typeof previousResolveRequest === 'function') {
    return previousResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

config.server = {
  ...config.server,
  port: 5180,
};

module.exports = config;
