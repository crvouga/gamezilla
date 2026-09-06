// @ts-check
const path = require('path');

/** @type {string} */
const RN_SCREENS_SCREEN_WEB_SHIM = path.resolve(
  __dirname,
  '../../pkgs/ui-rn/src/web/rn-screens-screen.web.tsx'
);

/**
 * Redirect react-native-screens' web Screen to our shim so `pointerEvents`
 * lands on `style` (RN Web 0.21+ deprecates the View prop).
 *
 * @param {string | undefined} filePath
 * @returns {boolean}
 */
function isRnScreensScreenWebModule(filePath) {
  if (typeof filePath !== 'string') return false;
  const normalized = filePath.replace(/\\/g, '/');
  return (
    normalized.includes('/react-native-screens/') &&
    (normalized.endsWith('/Screen.web.tsx') ||
      normalized.endsWith('/Screen.web.js'))
  );
}

/**
 * @param {import('metro').ResolutionContext} context
 * @param {string} moduleName
 * @param {string | null | undefined} platform
 * @returns {{ filePath: string; type: 'sourceFile' } | null}
 */
function tryResolveRnScreensScreenWebShim(context, moduleName, platform) {
  if (platform !== 'web') return null;
  const origin = context.originModulePath?.replace(/\\/g, '/') ?? '';
  if (!origin.includes('react-native-screens')) return null;
  const name = moduleName.replace(/\\/g, '/');
  if (
    name === './Screen.web' ||
    name.endsWith('/Screen.web') ||
    name.endsWith('/components/Screen.web')
  ) {
    return { filePath: RN_SCREENS_SCREEN_WEB_SHIM, type: 'sourceFile' };
  }
  return null;
}

/**
 * @param {import('metro').ResolutionContext} context
 * @param {{ filePath?: string; type?: string } | null | undefined} resolved
 * @param {string | null | undefined} platform
 * @returns {{ filePath: string; type: 'sourceFile' } | null | undefined}
 */
function redirectRnScreensScreenWebShim(context, resolved, platform) {
  void context;
  if (platform !== 'web') return resolved;
  if (isRnScreensScreenWebModule(resolved?.filePath)) {
    return { filePath: RN_SCREENS_SCREEN_WEB_SHIM, type: 'sourceFile' };
  }
  return resolved;
}

module.exports = {
  RN_SCREENS_SCREEN_WEB_SHIM,
  tryResolveRnScreensScreenWebShim,
  redirectRnScreensScreenWebShim,
};
