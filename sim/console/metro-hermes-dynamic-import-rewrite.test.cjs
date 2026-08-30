const {
  prepareHermesImportSrc,
  rewriteHermesDynamicImports,
} = require('./metro-hermes-dynamic-import-rewrite.cjs');

describe('rewriteHermesDynamicImports', () => {
  test('rewrites better-auth top-level import().then so Hermes has a Promise', () => {
    const src =
      'const AsyncLocalStoragePromise = import("node:async_hooks").then((mod) => mod.AsyncLocalStorage);';
    const out = rewriteHermesDynamicImports(src);
    expect(out).toContain('Promise.resolve().then');
    expect(out).toContain('require("node:async_hooks")');
    expect(out).not.toContain('import(');
  });

  test('rewrites relative adapter import to require', () => {
    const src =
      'const { createKyselyAdapter } = await import("../adapters/kysely-adapter/index.mjs");';
    const out = rewriteHermesDynamicImports(src);
    expect(out).toContain('require("../adapters/kysely-adapter/index.mjs")');
    expect(out).not.toContain('import(');
  });

  test('optional package import() becomes a rejected Promise', () => {
    const src =
      'import("@opentelemetry/api").then((mod) => mod).catch(() => {});';
    const out = rewriteHermesDynamicImports(src);
    expect(out).toContain('Promise.reject');
    expect(out).toContain('ERR_UNKNOWN_BUILTIN_MODULE');
    expect(out).toContain('("@opentelemetry/api")');
  });

  test('import(variable) becomes a rejected Promise', () => {
    const src = 'await import(nodeSqlite)';
    const out = rewriteHermesDynamicImports(src);
    expect(out).toContain('Promise.reject');
    expect(out).toContain('(nodeSqlite)');
    expect(out).not.toMatch(/\bimport\s*\(/);
  });

  test('web platform leaves import() and magic comments unchanged', () => {
    const src =
      'import(/* webpackIgnore: true */ this.#props.path.join(dir, fileName))';
    expect(
      prepareHermesImportSrc(src, 'web', '/kysely/file-migration-provider.js')
    ).toBe(src);
  });

  test('native rewrites computed import() in Kysely so Metro does not see Invalid call', () => {
    const src =
      'import(/* webpackIgnore: true */ this.#props.path.join(dir, fileName))';
    const out = prepareHermesImportSrc(
      src,
      'ios',
      '/node_modules/kysely/dist/esm/migration/file-migration-provider.js'
    );
    expect(out).toContain('Promise.reject');
    expect(out).not.toMatch(/\bimport\s*\(/);
  });

  test('native leaves Expo typeof import() type queries alone', () => {
    const src =
      "const { withDevTools } = require('./withDevTools') as typeof import('./withDevTools');";
    expect(
      prepareHermesImportSrc(
        src,
        'ios',
        '/node_modules/expo/src/launch/registerRootComponent.tsx'
      )
    ).toBe(src);
  });

  test('native guards NativeJSLogger.addListener when Expo Go lacks the emitter', () => {
    const src =
      'NativeJSLogger.addListener(listener.eventName, ({ message }) => { listener.action(message); });';
    const out = prepareHermesImportSrc(
      src,
      'ios',
      '/node_modules/expo-modules-core/src/sweet/setUpJsLogger.fx.ts'
    );
    expect(out).toContain(
      'typeof NativeJSLogger.addListener === "function" && NativeJSLogger.addListener('
    );
  });
});
