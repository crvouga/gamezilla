import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { heartsGameClient } from '@libs/hearts-client-ts/hearts-game-client';
import { HEARTS_ACTIONS } from './hearts-actions';
import { HEARTS_PLAYABLE } from './hearts-playable';

/** Hearts as the shared suites play it: the conformance adapter. */
export const HEARTS_HARNESS_GAME: HarnessGame = assertHarnessGame({
  ...HEARTS_PLAYABLE,
  client: heartsGameClient,
  actions: HEARTS_ACTIONS,
});
