/**
 * Quint entry for the `specs/<domain>/*.qnt` models this package runs
 * (`specDomains`): registers the world (the full app composition) and every
 * model's binding.
 */

import './app-platform.binding';

import { useQuintHarness } from '@libs/harness/quint/world';
import { openHarness } from '../harness/open-app-harness';

useQuintHarness(openHarness);
