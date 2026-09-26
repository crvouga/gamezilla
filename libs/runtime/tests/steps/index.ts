/**
 * Steps entry for `features/**`: registers the world (the full app
 * composition) and every step definition its features may use — the shared
 * platform steps and this package's own.
 */

import '@libs/sim-harness/spec/steps/platform';
import './app-shell.steps';

import { useSimWorld } from '@libs/sim-harness/spec/world';
import { openSim } from '../e2e/support/open-app-sim';

useSimWorld((testId) => openSim(testId));
