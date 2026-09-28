/**
 * Quint entry for the `specs/<domain>/*.qnt` models this package runs
 * (`specDomains`): registers the world (billing's lifecycle composition, whose
 * standing properties every model step is checked against) and every model's
 * binding.
 */

import './membership-lifecycle.binding';
import './payment-provider-switch.binding';

import { useQuintHarness } from '@libs/harness/quint/world';
import { openLifecycleHarness } from '../e2e/support/open-billing-lifecycle-harness';

useQuintHarness(openLifecycleHarness);
