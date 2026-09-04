// @io-wall-ok

import { assert, setHotAssertsEnabled } from '@pkgs/assert';
import { BrowserCrashHandler } from '@pkgs/assert/crash/crash-handler/crash-handler-browser';
import { ExpoCrashHandler } from '@pkgs/assert/crash/crash-handler/crash-handler-expo';
import { wallTimers } from '@pkgs/clock';
import { polyfill } from '@pkgs/polyfill';
import * as WebBrowser from 'expo-web-browser';
import { polyfillNativeLocationReload } from './polyfill-native-location-reload';
import { polyfillResponseBodyFromInit } from './polyfill-response-body';

WebBrowser.maybeCompleteAuthSession();
polyfillNativeLocationReload();
polyfillResponseBodyFromInit();

// Check / canary seam: lets a production-flavor build re-enable hot-path
// asserts (per-dispatch keyword validation, per-routed-message envelope
// checks, …) without a code change. Default is governed by `isDevBuild()`
// in `@pkgs/assert/hot-asserts`; set EXPO_PUBLIC_FORCE_HOT_ASSERTS
// to '1' / 'true' to force-on, or '0' / 'false' to force-off.
// Expo inlines EXPO_PUBLIC_*; bracket access required by noPropertyAccessFromIndexSignature. `noPropertyAccessFromIndexSignature` requires bracket `process.env` access; Expo still inlines `EXPO_PUBLIC_*`.
const forceHotAsserts = process.env['EXPO_PUBLIC_FORCE_HOT_ASSERTS'];
if (forceHotAsserts === '1' || forceHotAsserts === 'true') {
  setHotAssertsEnabled(true);
} else if (forceHotAsserts === '0' || forceHotAsserts === 'false') {
  setHotAssertsEnabled(false);
}

assert.registerCrashHandler(new BrowserCrashHandler(wallTimers));
assert.registerCrashHandler(new ExpoCrashHandler(wallTimers));

polyfill();

assert.ok(
  typeof globalThis.crypto !== 'undefined',
  'globalThis.crypto must exist after polyfill'
);
assert.ok(
  typeof globalThis.crypto.getRandomValues === 'function',
  'crypto.getRandomValues must be a function'
);
assert.notThrows(
  () => globalThis.crypto.getRandomValues(new Uint8Array(16)),
  'crypto.getRandomValues must accept Uint8Array'
);
assert.notThrows(
  () => globalThis.crypto.randomUUID(),
  'crypto.randomUUID must be available'
);
assert.ok(typeof Buffer !== 'undefined', 'Buffer must exist for room');
assert.notThrows(() => {
  const u = new Uint8Array([0xab, 0xcd, 0x3c, 0x3e]);
  const b64 = Buffer.from(u).toString('base64');
  const back = Buffer.from(b64, 'base64');
  assert.ok(
    back.length === u.length && back.every((b, i) => b === u[i]),
    'Buffer base64 round-trip'
  );
}, 'Buffer base64 must work for room (polyfill has no base64url encoding)');
assert.ok(
  typeof TextEncoder === 'function',
  'TextEncoder must exist for room crypto'
);
assert.ok(
  typeof globalThis.crypto.subtle?.digest === 'function',
  'crypto.subtle.digest must be a function (TtsClient cache key uses SHA-256)'
);
