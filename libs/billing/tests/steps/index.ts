/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (billing on the
 * platform alone) and every step definition its features may use — the
 * shared platform steps and this package's own.
 */

import '@libs/harness/spec/steps/platform';
import './access.steps';
import './membership.steps';
import './plans.steps';
import './provider-switch.steps';
import './time.steps';

import { useHarnessWorld } from '@libs/harness/spec/world';
import { openHarness } from '../harness/open-billing-harness';

useHarnessWorld(openHarness);
