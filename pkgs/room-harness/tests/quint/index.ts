/**
 * Quint entry for this package's models (`specs/room/*.qnt`): registers the room
 * trace world and every model's binding.
 */

import './shared-counter.binding';
import './match-clock.binding';

import { useRoomTraceWorld } from './world';

useRoomTraceWorld();
