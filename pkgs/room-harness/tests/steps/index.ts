/**
 * Steps entry for this package's features (`specs/room/*.feature`): registers the
 * room world and every step definition the features use.
 */

import './room.steps';
import './tally.steps';
import './ownership.steps';
import './match-clock.steps';

import { useRoomWorld } from './world';

useRoomWorld();
