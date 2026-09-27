/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (billing on the
 * platform alone) and every step definition its features may use — the
 * shared platform steps and this package's own.
 */

import '@libs/sim-harness/spec/steps/platform';
import './access.steps';
import './membership.steps';
import './time.steps';

import { useSimWorld } from '@libs/sim-harness/spec/world';
import { openSim } from '../e2e/support/open-billing-sim';

useSimWorld(openSim);
