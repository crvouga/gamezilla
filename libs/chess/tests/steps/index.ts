/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (this package's harness
 * composition) and every step definition its features may use — the shared
 * platform steps, this package's own, and the profile, billing and friends
 * steps it reuses (a second device, a Plus membership, friendship, and
 * joining a space).
 */

import '@libs/harness/spec/steps/platform';
import '@libs/profile/steps/profile.steps';
import '@libs/billing/steps/access.steps';
import '@libs/friends/steps/friends.steps';
import '@libs/friends/steps/spaces.steps';
import './puzzle-play.steps';
import './puzzle-feed.steps';
import './puzzle-rating.steps';
import './puzzle-review.steps';
import './puzzle-allowance.steps';
import './puzzle-spectator.steps';
import './puzzle-recovery.steps';
import './space-game.steps';

import { useHarnessWorld } from '@libs/harness/spec/world';
import { openSpecHarness } from '../harness/open-chess-harness';

useHarnessWorld(openSpecHarness);
