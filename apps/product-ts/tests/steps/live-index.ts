/** Live health binds the deployed environment without loading the local DOM harness. */
import '@libs/runtime-harness-ts/journeys.steps';
import '@libs/runtime-harness-ts/quoridor-journey.steps';
import './api.steps';
import './battleship.steps';
import './billing.steps';
import './client-config.steps';
import './connect-four.steps';
import './quoridor.steps';
import './database-trips.steps';
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
