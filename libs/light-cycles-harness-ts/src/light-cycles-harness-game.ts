import {
  assertHarnessGame,
  type SimulationHarnessGame,
} from '@libs/game-session-harness-ts/harness-game';
import {
  lightCyclesDuelClient,
  lightCyclesQuadClient,
  lightCyclesTrioClient,
} from '@libs/light-cycles-client-ts/light-cycles-game-client';
import {
  lightCyclesDuelShared,
  lightCyclesQuadShared,
  lightCyclesTrioShared,
} from '@libs/light-cycles-shared-ts/light-cycles-game';
import { LIGHT_CYCLES_ACTIONS } from './light-cycles-actions';
import { readLightCyclesRecord } from './light-cycles-record-reading';
import { lightCyclesSimulationFixtures } from './light-cycles-simulation-fixtures';

/** The actual product registrations of each mode; no fabricated turns. */
export const LIGHT_CYCLES_DUEL_HARNESS_GAME: SimulationHarnessGame =
  assertHarnessGame({
    label: 'Light Cycles Duel',
    shared: lightCyclesDuelShared,
    client: lightCyclesDuelClient,
    simulationFixtures: lightCyclesSimulationFixtures(2),
    readRecord: readLightCyclesRecord,
    actions: LIGHT_CYCLES_ACTIONS,
  });

export const LIGHT_CYCLES_TRIO_HARNESS_GAME: SimulationHarnessGame =
  assertHarnessGame({
    label: 'Light Cycles Trio',
    shared: lightCyclesTrioShared,
    client: lightCyclesTrioClient,
    simulationFixtures: lightCyclesSimulationFixtures(3),
    readRecord: readLightCyclesRecord,
    actions: LIGHT_CYCLES_ACTIONS,
  });

export const LIGHT_CYCLES_QUAD_HARNESS_GAME: SimulationHarnessGame =
  assertHarnessGame({
    label: 'Light Cycles Quad',
    shared: lightCyclesQuadShared,
    client: lightCyclesQuadClient,
    simulationFixtures: lightCyclesSimulationFixtures(4),
    readRecord: readLightCyclesRecord,
    actions: LIGHT_CYCLES_ACTIONS,
  });
