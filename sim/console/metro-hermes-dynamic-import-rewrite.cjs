/**
 * Rewrite `import()` so Hermes can evaluate the iOS bundle.
 * Only better-auth / Kysely — Expo uses TypeScript `typeof import("./x")`
 * which a global rewrite turns into invalid syntax.
 */
'use strict';

const REJECT_IMPORT =
  '(function(){return Promise.reject(Object.assign(new Error("dynamic import"),{code:"ERR_UNKNOWN_BUILTIN_MODULE"}));})(';

function stripImportMagicComments(src) {
  return src
    .replace(/\/\*\s*@vite-ignore\s*\*\//g, '')
    .replace(/\/\*\s*webpackIgnore:\s*true\s*\*\//g, '');
}

function shouldRewriteHermesImports(filename) {
  if (typeof filename !== 'string' || filename.length === 0) return false;
  const n = filename.replace(/\\/g, '/');
  return (
    n.includes('@better-auth') ||
    n.includes('/better-auth/') ||
    n.includes('/kysely/') ||
    n.includes('/kysely@')
  );
}

function rewriteHermesDynamicImports(src) {
  if (!src.includes('import(')) return src;
  let out = src;
  out = out.replace(
    /\bimport\s*\(\s*(["'])(\.\.?\/[^"'\\]*)\1\s*\)/g,
    'Promise.resolve().then(function(){return require($1$2$1);})'
  );
  out = out.replace(
    /\bimport\s*\(\s*(["'])(node:async_hooks|async_hooks|node:sqlite)\1\s*\)/g,
    'Promise.resolve().then(function(){return require($1$2$1);})'
  );
  return out.replace(/\bimport\s*\(/g, REJECT_IMPORT);
}

function guardNativeJsLoggerAddListener(src) {
  if (!src.includes('NativeJSLogger.addListener')) return src;
  return src.replace(
    /NativeJSLogger\.addListener\(/g,
    'typeof NativeJSLogger.addListener === "function" && NativeJSLogger.addListener('
  );
}

function prepareHermesImportSrc(src, platform, filename) {
  // Web must keep Vite/webpack ignore comments. Stripping them makes Metro
  // try to transform Kysely's `import(path.join(...))` and fail with
  // "Invalid call".
  if (platform !== 'ios' && platform !== 'android') return src;
  const name = typeof filename === 'string' ? filename : '';
  let next = src;
  if (name.includes('setUpJsLogger')) {
    next = guardNativeJsLoggerAddListener(next);
  }
  if (!shouldRewriteHermesImports(filename)) return next;
  return rewriteHermesDynamicImports(stripImportMagicComments(next));
}

module.exports = {
  stripImportMagicComments,
  shouldRewriteHermesImports,
  rewriteHermesDynamicImports,
  guardNativeJsLoggerAddListener,
  prepareHermesImportSrc,
};
