import '@libs/account-privacy/steps/privacy.steps';
/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (the full app
 * composition) and every step definition its features may use — the shared
 * platform steps and this package's own. The critical journeys' steps run
 * on {@link harnessJourneyHost} here and on a real browser in `@apps/product`.
 */

import '@libs/harness/spec/steps/platform';
import '@libs/profile/steps/profile.steps';
import './accessibility.steps';
import './app-lifecycle.steps';
import './app-shell.steps';
import './journeys.steps';
import './settings.steps';
import './device-layout.steps';
import './privacy-retention.steps';

import { useHarnessWorld } from '@libs/harness/spec/world';
import { openHarness } from '../harness/open-app-harness';
import { harnessJourneyHost } from './journey-harness-host';

useHarnessWorld(openHarness, (w) => ({ journey: harnessJourneyHost(w) }));
