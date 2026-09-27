/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (the full app
 * composition) and every step definition its features may use — the shared
 * platform steps and this package's own. The critical journeys' steps run
 * on {@link simJourneyHost} here and on a real browser in `@apps/product`.
 */

import '@libs/sim-harness/spec/steps/platform';
import './app-shell.steps';
import './journeys.steps';

import { useSimWorld } from '@libs/sim-harness/spec/world';
import { openSim } from '../e2e/support/open-app-sim';
import { simJourneyHost } from './journey-sim-host';

useSimWorld(
  (testId) => openSim(testId),
  (w) => ({ journey: simJourneyHost(w) })
);
