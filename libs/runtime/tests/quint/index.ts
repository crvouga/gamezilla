/**
 * Quint entry for the `specs/<domain>/*.qnt` models this package runs
 * (`specDomains`): registers the world (the full app composition) and every
 * model's binding.
 */

import './app-platform.binding';

import { useQuintSim } from '@libs/sim-harness/quint/world';
import { openSim } from '../e2e/support/open-app-sim';

useQuintSim(openSim);
