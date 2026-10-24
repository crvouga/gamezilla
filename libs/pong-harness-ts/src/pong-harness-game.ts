import {
  assertHarnessGame,
  type SimulationHarnessGame,
} from '@libs/game-session-harness-ts/harness-game';
import { pongGameClient } from '@libs/pong-client-ts/pong-game-client';
import { pongGameShared } from '@libs/pong-shared-ts/pong-game';
import { PONG_ACTIONS } from './pong-actions';
import { PONG_LOCAL_ACTIONS } from './pong-local-actions';
import { prepareLocalPongViewer } from './pong-local-courts';
import { readPongRecord } from './pong-record-reading';
import { PONG_SHARED_ACTIONS } from './pong-shared-actions';
import { PONG_SIMULATION_FIXTURES } from './pong-simulation-fixtures';

/** The actual product registrations; continuous conformance supplies no fabricated turns. */
export const PONG_HARNESS_GAME: SimulationHarnessGame = assertHarnessGame({
  label: 'Pong',
  shared: pongGameShared,
  client: pongGameClient,
  simulationFixtures: PONG_SIMULATION_FIXTURES,
  readRecord: readPongRecord,
  actions: [
    ...PONG_ACTIONS,
    ...PONG_LOCAL_ACTIONS,
    ...PONG_SHARED_ACTIONS,
    prepareLocalPongViewer,
  ],
});
