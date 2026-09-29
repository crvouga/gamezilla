// @io-wall-ok
import { wallTimers } from '@pkgs/clock/wall';
import type { RemoteReportsAppProps } from '@pkgs/harness-report/client';
import { createGlobalHttpClient } from '@pkgs/http-client/global';

/** Wall transport and timers for the reports screen. */
export function wallReportsEnv(): Pick<
  RemoteReportsAppProps,
  'http' | 'timers'
> {
  return { http: createGlobalHttpClient(), timers: wallTimers };
}
