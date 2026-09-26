/**
 * Steps entry for `features/**`: registers the world (billing on the
 * platform alone) and every step definition its features may use — the
 * shared platform steps and this package's own.
 */

import '@libs/sim-harness/spec/steps/platform';
import './access.steps';
import './membership.steps';

import { useSimWorld } from '@libs/sim-harness/spec/world';
import { openSim } from '../e2e/support/open-billing-sim';

useSimWorld((testId) => openSim(testId));
