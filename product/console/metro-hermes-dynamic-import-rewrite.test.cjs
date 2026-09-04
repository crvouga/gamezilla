const {
  prepareHermesImportSrc,
  guardNativeJsLoggerAddListener,
} = require('./metro-hermes-dynamic-import-rewrite.cjs');

describe('prepareHermesImportSrc', () => {
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

  test('guardNativeJsLoggerAddListener is a no-op without the call', () => {
    expect(guardNativeJsLoggerAddListener('const x = 1')).toBe('const x = 1');
  });
});
