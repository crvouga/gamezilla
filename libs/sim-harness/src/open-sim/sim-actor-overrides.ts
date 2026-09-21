/**
 * Wall Node timers for openSim teardown (settle after the sim disposes).
 */

import {
  clearInterval as nodeClearInterval,
  clearTimeout as nodeClearTimeout,
  setInterval as nodeSetInterval,
  setTimeout as nodeSetTimeout,
} from 'node:timers';
import type { Timers } from '@pkgs/clock';

export const simNodeTimers: Timers = {
  setTimeout: (fn, ms) => nodeSetTimeout(fn, ms),
  clearTimeout: (handle) => {
    nodeClearTimeout(handle as ReturnType<typeof nodeSetTimeout>);
  },
  setInterval: (fn, ms) => nodeSetInterval(fn, ms),
  clearInterval: (handle) => {
    nodeClearInterval(handle as ReturnType<typeof nodeSetInterval>);
  },
};
