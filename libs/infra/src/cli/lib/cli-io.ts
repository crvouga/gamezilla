// @io-wall-ok
/**
 * Infra CLI composition root — wall clock/timers/HTTP/ids for the process.
 */
import { wallClock, wallTimers } from '@pkgs/clock';
import { createGlobalHttpClient } from '@pkgs/http-client';

export const cliClock = wallClock;
export const cliTimers = wallTimers;
export const cliHttp = createGlobalHttpClient();
export const cliCreateId = (): string => crypto.randomUUID();
