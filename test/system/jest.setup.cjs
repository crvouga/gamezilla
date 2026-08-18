/**
 * Jest setupAfterEnv for @test/system product simulations.
 * Real timers: renderRouter enables fake timers; we need wall async for I/O.
 */
jest.useRealTimers();

// Official Reanimated Jest matchers (after real timers so product sims keep
// wall async for Hono/SQLite). Use the same `/mock` entry expo-router loads.
require('react-native-reanimated/mock').setUpTests();

// Lingui macros compile to `@lingui/core` `i18n._(...)`. Bun can nest two
// core copies; activate `en` on the instance Jest resolves so `t` / `Trans`
// work without a race against AppI18nProvider's side-effect import.
const { i18n } = require('@lingui/core');
if (i18n.locale == null || i18n.locale === '') {
  i18n.loadAndActivate({ locale: 'en', messages: {} });
}

// Product async (AuthBridge, health ping) updates outside act by design under
// this harness — drown-out act noise so scenario logs stay readable.
const origError = console.error.bind(console);
console.error = (...args) => {
  const first = args[0];
  if (typeof first === 'string' && first.includes('not wrapped in act(...)')) {
    return;
  }
  origError(...args);
};
