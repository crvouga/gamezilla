/**
 * Wall Node timers for openHarness teardown (settle after the harness disposes).
 */

import {
  clearInterval as nodeClearInterval,
  clearTimeout as nodeClearTimeout,
  setInterval as nodeSetInterval,
  setTimeout as nodeSetTimeout,
} from 'node:timers';
import type { Timers } from '@pkgs/clock-shared/types';

export const harnessNodeTimers: Timers = {
  setTimeout: (fn, ms) => nodeSetTimeout(fn, ms),
  clearTimeout: (handle) => {
    nodeClearTimeout(handle as ReturnType<typeof nodeSetTimeout>);
  },
  setInterval: (fn, ms) => nodeSetInterval(fn, ms),
  clearInterval: (handle) => {
    nodeClearInterval(handle as ReturnType<typeof nodeSetInterval>);
  },
};
