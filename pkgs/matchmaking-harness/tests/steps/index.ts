/**
 * Steps entry for this package's features (`specs/matchmaking/*.feature`):
 * registers the matchmaking world and every step definition the features use.
 */

import './matchmaking.steps';

import { useMatchmakingWorld } from './world';

useMatchmakingWorld();
