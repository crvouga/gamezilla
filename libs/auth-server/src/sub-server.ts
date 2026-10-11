import { AUTH_TELEMETRY } from '@libs/auth-shared/telemetry';
import { defineSubServer } from '@libs/sub-shared/server';

export const AUTH_SERVER = defineSubServer({
  name: 'auth',
  telemetryEvents: AUTH_TELEMETRY,
});
