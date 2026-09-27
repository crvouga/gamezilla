/**
 * Quint entry for the `specs/<domain>/*.qnt` models this package runs
 * (`specDomains`): registers the world (this package's sim composition) and
 * every model's binding.
 */

import './puzzle-session.binding';

import { useQuintSim } from '@libs/sim-harness/quint/world';
import { openSim } from '../e2e/support/open-chess-sim';

useQuintSim(openSim);
