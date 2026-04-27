import { assert } from '@gamezilla/lib/assert';
import { BrowserCrashHandler } from '@gamezilla/lib/assert/crash/crash-handler/crash-handler-browser';
import { ExpoCrashHandler } from '@gamezilla/lib/assert/crash/crash-handler/crash-handler-expo';
import { polyfill } from '@gamezilla/lib/polyfill';

import { suppressThirdPartyWarnings } from './suppress-third-party-warnings';

suppressThirdPartyWarnings();

assert.registerCrashHandler(new BrowserCrashHandler());
assert.registerCrashHandler(new ExpoCrashHandler());

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
assert.ok(typeof Buffer !== 'undefined', 'Buffer must exist for peer-store');
assert.notThrows(
  () => {
    const u = new Uint8Array([0xab, 0xcd, 0x3c, 0x3e]);
    const b64 = Buffer.from(u).toString('base64');
    const back = Buffer.from(b64, 'base64');
    assert.ok(
      back.length === u.length && back.every((b, i) => b === u[i]),
      'Buffer base64 round-trip'
    );
  },
  'Buffer base64 must work for peer-store (polyfill has no base64url encoding)'
);
assert.ok(
  typeof TextEncoder === 'function',
  'TextEncoder must exist for peer-store crypto'
);
