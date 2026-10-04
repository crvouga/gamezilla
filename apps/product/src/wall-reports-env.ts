// @io-wall-ok
import { wallTimers } from '@pkgs/clock-shared/wall';
import type { RemoteReportsAppProps } from '@pkgs/harness-report-client/remote-reports-app';
import { createGlobalHttpClient } from '@pkgs/http-client-shared/global';

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
