// @io-wall-ok
import { assert, setHotAssertsEnabled } from '@pkgs/assert';
import { BrowserCrashHandler } from '@pkgs/assert-crash-browser';
import { wallTimers } from '@pkgs/clock/wall';
import { polyfillBuffer } from '@pkgs/polyfill/buffer';

const forceHotAsserts = import.meta.env.VITE_FORCE_HOT_ASSERTS;
if (forceHotAsserts === '1' || forceHotAsserts === 'true') {
  setHotAssertsEnabled(true);
} else if (forceHotAsserts === '0' || forceHotAsserts === 'false') {
  setHotAssertsEnabled(false);
}

polyfillBuffer();
assert.registerCrashHandler(new BrowserCrashHandler(wallTimers));
