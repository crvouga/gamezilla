import { battleshipGameClient } from '@libs/battleship-client-ts/battleship-game-client';
import type { HarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { assertHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import { BATTLESHIP_ACTIONS } from './battleship-actions';
import { BATTLESHIP_BOT_ACTIONS } from './battleship-bots';
import { BATTLESHIP_PLAYABLE } from './battleship-playable';
import { readBattleshipRecord } from './battleship-record-reading';

/** Battleship as the shared suites play it: the conformance adapter. */
export const BATTLESHIP_HARNESS_GAME: HarnessGame = assertHarnessGame({
  ...BATTLESHIP_PLAYABLE,
  client: battleshipGameClient,
  actions: [...BATTLESHIP_ACTIONS, ...BATTLESHIP_BOT_ACTIONS],
  readRecord: readBattleshipRecord,
});
