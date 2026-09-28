/**
 * Quint entry for this package's models (`specs/matchmaking/*.qnt`):
 * registers the matchmaking trace world and every model's binding.
 */

import './matching.binding';

import { useMatchmakingTraceWorld } from './world';

useMatchmakingTraceWorld();
