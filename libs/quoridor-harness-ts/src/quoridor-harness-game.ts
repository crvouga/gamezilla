import { assertHarnessGame } from '@libs/game-session-harness-ts/harness-game';
import {
  quoridorGameClient,
  quoridorHillGameClient,
} from '@libs/quoridor-client-ts/quoridor-game-client';
import { QUORIDOR_ACTIONS } from './quoridor-actions';
import {
  establishQuoridorBotVictory,
  playQuoridorBot,
} from './quoridor-bot-actions';
import { QUORIDOR_MODEL_ACTIONS } from './quoridor-model';
import { QUORIDOR_HILL_PLAYABLE, QUORIDOR_PLAYABLE } from './quoridor-playable';
import { readQuoridorRecord } from './quoridor-record-reading';

export const QUORIDOR_HARNESS_GAME = assertHarnessGame({
  ...QUORIDOR_PLAYABLE,
  client: quoridorGameClient,
  actions: [
    ...QUORIDOR_ACTIONS,
    ...QUORIDOR_MODEL_ACTIONS,
    establishQuoridorBotVictory,
    playQuoridorBot,
  ],
  readRecord: readQuoridorRecord,
});

export const QUORIDOR_HILL_HARNESS_GAME = assertHarnessGame({
  ...QUORIDOR_HILL_PLAYABLE,
  client: quoridorHillGameClient,
  actions: QUORIDOR_ACTIONS,
  readRecord: readQuoridorRecord,
});
