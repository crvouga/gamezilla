// @io-wall-ok
import { wallTimers } from '@pkgs/clock/wall';
import type { RemoteReportsAppProps } from '@pkgs/harness-report/client';
import { createGlobalHttpClient } from '@pkgs/http-client/global';

import { wallReportCache } from './wall-report-cache';

/** Wall transport, timers and the persistent reports cache. */
export function wallReportsEnv(): Pick<
  RemoteReportsAppProps,
  'http' | 'timers' | 'cache'
> {
  return {
    http: createGlobalHttpClient(),
    timers: wallTimers,
    cache: wallReportCache(),
  };
}
