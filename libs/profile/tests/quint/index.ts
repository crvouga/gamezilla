/**
 * Quint entry for the `specs/<domain>/*.qnt` models this package runs
 * (`specDomains`): registers the world (this package's harness composition) and
 * every model's binding.
 */

import './account-sign-in.binding';
import './username-changes.binding';

import { useQuintHarness } from '@libs/harness/quint/world';
import { openHarness } from '../e2e/support/open-profile-harness';

useQuintHarness(openHarness);
