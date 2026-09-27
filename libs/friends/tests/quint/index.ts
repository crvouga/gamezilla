/**
 * Quint entry for the `specs/<domain>/*.qnt` models this package runs
 * (`specDomains`): registers the world (this package's sim composition) and
 * every model's binding.
 */

import './friendship.binding';
import './space-hosting.binding';

import { useQuintSim } from '@libs/sim-harness/quint/world';
import { openSim } from '../e2e/support/open-friends-sim';

useQuintSim(openSim);
