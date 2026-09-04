/**
 * Jest setupAfterEnv for @product/test product simulations.
 * Real timers: renderRouter enables fake timers; we need wall async for I/O.
 */
import { i18n } from '@lingui/core';
import { installJestUiTestRunner } from '@pkgs/ui-testing/runner/jest';

jest.useRealTimers();

installJestUiTestRunner({ fidelity: 'sim', driverKind: 'rntl' });

// Official Reanimated Jest matchers (after real timers so product sims keep
// wall async for Hono/SQLite). Use the same `/mock` entry expo-router loads.
require('react-native-reanimated/mock').setUpTests();

// Lingui macros compile to `@lingui/core` `i18n._(...)`. Bun can nest two
// core copies; activate `en` on the instance Jest resolves so `t` / `Trans`
// work without a race against AppI18nProvider's side-effect import.
if (i18n.locale == null || i18n.locale === '') {
  i18n.loadAndActivate({ locale: 'en', messages: {} });
}

// Product async (AuthBridge, health ping) updates outside act by design under
// this harness — drown-out act noise so scenario logs stay readable.
// Also ignore late Better Auth / closed-DB noise after openSim.dispose.
const origError = console.error.bind(console);
console.error = (...args) => {
  const text = args
    .map((a) =>
      typeof a === 'string' ? a : a instanceof Error ? a.message : ''
    )
    .join(' ');
  if (text.includes('not wrapped in act(...)')) return;
  if (text.includes('Cannot log after tests are done')) return;
  if (text.includes('Database is closed')) return;
  if (text.includes('createSim: server disposed')) return;
  if (
    text.includes(
      'You are trying to `import` a file after the Jest environment'
    )
  )
    return;
  origError(...args);
};
