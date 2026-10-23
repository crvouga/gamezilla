// @io-wall-ok

import { BrowserCrashHandler } from '@pkgs/assert-crash-browser-client-ts/crash-handler-browser';
import { setHotAssertsEnabled } from '@pkgs/assert-root-shared-ts/hot-asserts';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { wallTimers } from '@pkgs/clock-shared-ts/wall';
import { polyfillBuffer } from '@pkgs/polyfill-shared-ts/buffer';

const forceHotAsserts = import.meta.env.VITE_FORCE_HOT_ASSERTS;
if (forceHotAsserts === '1' || forceHotAsserts === 'true') {
  setHotAssertsEnabled(true);
} else if (forceHotAsserts === '0' || forceHotAsserts === 'false') {
  setHotAssertsEnabled(false);
}

polyfillBuffer();
assert.registerCrashHandler(new BrowserCrashHandler(wallTimers));
