/**
 * Hermes iOS bundle helpers. Keep NativeJSLogger guard; do not rewrite
 * dynamic imports globally (breaks Expo `typeof import("./x")`).
 */
'use strict';

function guardNativeJsLoggerAddListener(src) {
  if (!src.includes('NativeJSLogger.addListener')) return src;
  return src.replace(
    /NativeJSLogger\.addListener\(/g,
    'typeof NativeJSLogger.addListener === "function" && NativeJSLogger.addListener('
  );
}

function prepareHermesImportSrc(src, platform, filename) {
  if (platform !== 'ios' && platform !== 'android') return src;
  const name = typeof filename === 'string' ? filename : '';
  if (name.includes('setUpJsLogger')) {
    return guardNativeJsLoggerAddListener(src);
  }
  return src;
}

module.exports = {
  guardNativeJsLoggerAddListener,
  prepareHermesImportSrc,
};
