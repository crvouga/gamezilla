import { AUTH_TELEMETRY } from '@libs/auth-shared-ts/telemetry';
import { defineSubServer } from '@libs/sub-shared-ts/server';

export const AUTH_SERVER = defineSubServer({
  name: 'auth',
  telemetryEvents: AUTH_TELEMETRY,
});
