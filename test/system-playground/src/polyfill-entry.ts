// @io-wall-ok
/**
 * Minimal polyfill entry for the system playground (Expo web).
 */

import { assert } from '@pkgs/assert';
import { BrowserCrashHandler } from '@pkgs/assert/crash/crash-handler/crash-handler-browser';
import { ExpoCrashHandler } from '@pkgs/assert/crash/crash-handler/crash-handler-expo';
import { wallIo } from '@pkgs/io';
import { polyfill } from '@pkgs/polyfill';

const polyfillIo = wallIo();
assert.registerCrashHandler(new BrowserCrashHandler(polyfillIo.timers));
assert.registerCrashHandler(new ExpoCrashHandler(polyfillIo.timers));
polyfill();
