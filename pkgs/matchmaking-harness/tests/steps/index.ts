/**
 * Steps entry for this package's features (`specs/matchmaking/*.feature`):
 * registers the matchmaking world and every step definition the features use.
 */

import './matchmaking.steps';
import './groups.steps';
import './recovery.steps';
import './ranges.steps';
import './restrictions.steps';

import { useMatchmakingWorld } from './world';

useMatchmakingWorld();
