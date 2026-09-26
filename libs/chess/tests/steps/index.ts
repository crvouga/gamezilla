/**
 * Steps entry for `features/**`: registers the world (this package's sim
 * composition) and every step definition its features may use — the shared
 * platform steps, this package's own, and the profile and friends steps it
 * reuses (a second device, friendship, and joining a space).
 */

import '@libs/sim-harness/spec/steps/platform';
import '@libs/profile/steps/profile.steps';
import '@libs/friends/steps/friends.steps';
import '@libs/friends/steps/spaces.steps';
import './puzzle-play.steps';
import './puzzle-feed.steps';
import './puzzle-rating.steps';
import './puzzle-review.steps';
import './puzzle-allowance.steps';
import './puzzle-spectator.steps';
import './space-game.steps';

import { useSimWorld } from '@libs/sim-harness/spec/world';
import { openSim } from '../e2e/support/open-chess-sim';

useSimWorld(openSim);
