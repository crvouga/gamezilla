/**
 * Steps entry for the `specs/<domain>/` features this package runs against a
 * deployed environment (`liveDomains`, `bun run health`): registers the live
 * world and every step definition — the health checks' own and the critical
 * journeys' (shared with the harness run in `@libs/runtime`).
 */

import '@libs/runtime/steps/journeys.steps';
import './api.steps';
import './billing.steps';
import './client-config.steps';
import './finding-a-person.steps';
import './google-oauth.steps';
import './infrastructure.steps';
import './object-store.steps';
import './postgres.steps';
import './realtime-broker.steps';
import './rooms.steps';
import './secrets.steps';
import './traces.steps';
import './web-app.steps';

import { useLiveWorld } from './live-world';

useLiveWorld();
