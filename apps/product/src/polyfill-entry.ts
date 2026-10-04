// @io-wall-ok
import { assert } from '@pkgs/assert-shared/singleton';
import { setHotAssertsEnabled } from '@pkgs/assert-shared/hot-asserts';
import { BrowserCrashHandler } from '@pkgs/assert-crash-browser-client/crash-handler-browser';
import { wallTimers } from '@pkgs/clock-shared/wall';
import { polyfillBuffer } from '@pkgs/polyfill-shared/buffer';

const forceHotAsserts = import.meta.env.VITE_FORCE_HOT_ASSERTS;
if (forceHotAsserts === '1' || forceHotAsserts === 'true') {
  setHotAssertsEnabled(true);
} else if (forceHotAsserts === '0' || forceHotAsserts === 'false') {
  setHotAssertsEnabled(false);
}

polyfillBuffer();
assert.registerCrashHandler(new BrowserCrashHandler(wallTimers));
