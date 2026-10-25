import type { ProductHarness } from '@libs/harness-ts/harness';
import type { CatalogAction } from '@pkgs/harness-root-shared-ts/effect';
import {
  comeBack,
  goAway,
  stayAwayInRound,
  watchWithConnection,
} from './light-cycles-away';
import { chooseBot, chooseTargetScore } from './light-cycles-choices';
import { switchDevices } from './light-cycles-devices';
import {
  callOffLightCycles,
  reachLightCyclesStage,
  winLightCycles,
} from './light-cycles-game-actions';
import {
  establishEveryRiderReady,
  establishLightCyclesGame,
  joinLightCycles,
  readyLightCyclesGame,
  startLightCyclesGame,
} from './light-cycles-lineup';
import {
  establishPractice,
  findPlayers,
  joinSpaceOf,
  pairPeopleUp,
  pickLightCyclesMode,
  startPractice,
  takeLightCyclesSeat,
} from './light-cycles-modes';
import {
  steerLightCyclesRider,
  steerQuickly,
} from './light-cycles-person-steering';
import {
  boxInBotRiders,
  crashRiders,
  endCountdown,
  placeLightCyclesArena,
  reachRoundCountdown,
  reachRoundEnd,
  reachRoundRiding,
  steerAsRoundEnds,
  takeNextStep,
  winRound,
} from './light-cycles-riding-actions';
import { arrangeRoundWins } from './light-cycles-round-actions';
import { endRoundDrawn } from './light-cycles-round-over';

/** Light Cycles' own testing-tool actions, beside every shared game action. */
export const LIGHT_CYCLES_ACTIONS: readonly CatalogAction<ProductHarness>[] = [
  establishLightCyclesGame,
  establishEveryRiderReady,
  readyLightCyclesGame,
  startLightCyclesGame,
  joinLightCycles,
  takeLightCyclesSeat,
  chooseTargetScore,
  chooseBot,
  establishPractice,
  startPractice,
  joinSpaceOf,
  pickLightCyclesMode,
  findPlayers,
  pairPeopleUp,
  placeLightCyclesArena,
  boxInBotRiders,
  arrangeRoundWins,
  endRoundDrawn,
  takeNextStep,
  endCountdown,
  steerLightCyclesRider,
  steerQuickly,
  crashRiders,
  reachRoundCountdown,
  reachRoundRiding,
  reachRoundEnd,
  winRound,
  steerAsRoundEnds,
  winLightCycles,
  callOffLightCycles,
  reachLightCyclesStage,
  goAway,
  comeBack,
  stayAwayInRound,
  watchWithConnection,
  switchDevices,
];
