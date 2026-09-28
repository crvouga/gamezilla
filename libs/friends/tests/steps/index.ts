/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (this package's harness
 * composition) and every step definition its features may use — the shared
 * platform steps, this package's own, and the profile and billing steps it
 * reuses (a Plus membership lifts the hosting limit).
 */

import '@libs/harness/spec/steps/platform';
import '@libs/profile/steps/profile.steps';
import '@libs/billing/steps/access.steps';
import './friends.steps';
import './search.steps';
import './spaces.steps';

import { useHarnessWorld } from '@libs/harness/spec/world';
import { openHarness } from '../e2e/support/open-friends-harness';

useHarnessWorld(openHarness);
