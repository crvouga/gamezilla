/**
 * Steps entry for this package's features (`specs/rooms/*.feature`): registers the
 * room world and every step definition the features use.
 */

import './room.steps';
import './counter.steps';
import './match-clock.steps';

import { useRoomWorld } from './world';

useRoomWorld();
