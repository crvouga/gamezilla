import { defineSubClient } from '@libs/sub-client-ts/client';
import { LiveSessionReporter } from './live-session-reporter';

export const LIVE_REPORTING_CLIENT = defineSubClient({
  name: 'observatory',
  routes: [],
  session: LiveSessionReporter,
});
