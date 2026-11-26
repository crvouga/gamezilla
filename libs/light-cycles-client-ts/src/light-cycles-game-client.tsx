import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import type { LightCyclesRiderCount } from '@libs/light-cycles-shared-ts/light-cycles-config';
import {
  lightCyclesDuelShared,
  lightCyclesQuadShared,
  lightCyclesTrioShared,
} from '@libs/light-cycles-shared-ts/light-cycles-game';
import { t } from '@lingui/core/macro';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { LightCyclesBoard } from './light-cycles-board';
import { decodeLightCycles } from './light-cycles-board-view';
import { lightCyclesFrame } from './light-cycles-frame';
import { lightCyclesLesson } from './light-cycles-lesson';
import { riderName } from './light-cycles-view';

/** The round limit reached with the lead shared: the rules' only draw. */
function sharedLead(position: string): string | undefined {
  const state = decodeLightCycles(position);
  const result = state?.result;
  if (state === null || result?.winner !== 'draw') return undefined;
  return result.reason === 'round limit'
    ? t`All ${state.round} rounds were played, and the most round wins were shared.`
    : undefined;
}

const presentation = (name: () => string, riders: LightCyclesRiderCount) => ({
  name,
  goal: () =>
    t`Outlast the other riders. Every trail and the arena's edge crash you.`,
  canFlip: false,
  Board: LightCyclesBoard,
  sideLabel: riderName,
  frame: lightCyclesFrame(riders),
  endingDescription: (reason: string) =>
    reason === 'target score'
      ? t`The target score was reached.`
      : reason === 'round limit'
        ? t`The 15th round was played; the rider with the most round wins takes the game.`
        : undefined,
  rulesDrawDescription: sharedLead,
  endingLabel: (reason: string) =>
    reason === 'target score'
      ? t`target score`
      : reason === 'round limit'
        ? t`round limit`
        : reason,
});

export const lightCyclesDuelClient = defineGameClient({
  shared: lightCyclesDuelShared,
  title: 'Light Cycles Duel',
  mode: { game: 'Light Cycles', name: 'Duel' },
  caption: 'Two riders, one arena of light trails',
  tile: 'trails',
  subtitle: () => <Trans>Outlast your rival on the grid.</Trans>,
  lesson: lightCyclesLesson(2),
  presentation: presentation(() => t`Light Cycles Duel`, 2),
});

export const lightCyclesTrioClient = defineGameClient({
  shared: lightCyclesTrioShared,
  title: 'Light Cycles Trio',
  mode: { game: 'Light Cycles', name: 'Trio' },
  caption: 'Three riders, one arena of light trails',
  tile: 'trails',
  subtitle: () => <Trans>Be the last of three riders riding.</Trans>,
  lesson: lightCyclesLesson(3),
  presentation: presentation(() => t`Light Cycles Trio`, 3),
});

export const lightCyclesQuadClient = defineGameClient({
  shared: lightCyclesQuadShared,
  title: 'Light Cycles Quad',
  mode: { game: 'Light Cycles', name: 'Quad' },
  caption: 'Four riders, one arena of light trails',
  tile: 'trails',
  subtitle: () => <Trans>Be the last of four riders riding.</Trans>,
  lesson: lightCyclesLesson(4),
  presentation: presentation(() => t`Light Cycles Quad`, 4),
});
