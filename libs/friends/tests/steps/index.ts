/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (this package's sim
 * composition) and every step definition its features may use — the shared
 * platform steps, this package's own, and the profile steps it reuses.
 */

import '@libs/sim-harness/spec/steps/platform';
import '@libs/profile/steps/profile.steps';
import './friends.steps';
import './search.steps';
import './spaces.steps';

import { useSimWorld } from '@libs/sim-harness/spec/world';
import { openSim } from '../e2e/support/open-friends-sim';

useSimWorld(openSim);
