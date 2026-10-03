// The one registration entry selects the runner's injected world.
// Live checks use server ports without loading the in-process browser app.
if (process.env['SPEC_WORLD'] !== 'live') await import('./developer-world');

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
