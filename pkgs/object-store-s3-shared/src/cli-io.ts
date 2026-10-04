// @io-wall-ok
import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';
import { createGlobalHttpClient } from '@pkgs/http-client-shared/global';

export const cliClock = wallClock;
export const cliTimers = wallTimers;
export const cliHttp = createGlobalHttpClient();
export const cliCreateId = (): string => crypto.randomUUID();
