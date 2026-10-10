import { AUTH_TELEMETRY } from '@libs/auth-shared/telemetry';
import { defineFeatureServer } from '@libs/feature-shared/server';

export const AUTH_SERVER = defineFeatureServer({
  name: 'auth',
  telemetryEvents: AUTH_TELEMETRY,
});
