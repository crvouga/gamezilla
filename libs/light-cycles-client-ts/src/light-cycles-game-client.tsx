import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import {
  lightCyclesDuelShared,
  lightCyclesQuadShared,
  lightCyclesTrioShared,
} from '@libs/light-cycles-shared-ts/light-cycles-game';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { LightCyclesBoard } from './light-cycles-board';
import { LightCyclesOptions } from './light-cycles-options';
import { riderName } from './light-cycles-view';

const presentation = (name: () => string) => ({
  name,
  canFlip: false,
  Board: LightCyclesBoard,
  Configuration: LightCyclesOptions,
  sideLabel: riderName,
  endingDescription: (reason: string) =>
    reason === 'target score'
      ? t`The target score was reached.`
      : reason === 'round limit'
        ? t`The 15th round was played; the rider with the most round wins takes the game.`
        : undefined,
  endingLabel: (reason: string) =>
    reason === 'target score'
      ? t`target score`
      : reason === 'round limit'
        ? t`round limit`
        : reason,
});

const instructions = () => (
  <Trans>
    Steer your rider around the arena. Every rider leaves a light trail; the
    edge and every trail crash a rider. The last rider riding wins the round,
    and the first to the target score wins the game. Ride against bots, share a
    device, invite people, or find players.
  </Trans>
);

export const lightCyclesDuelClient = defineGameClient({
  shared: lightCyclesDuelShared,
  title: 'Light Cycles Duel',
  caption: 'Two riders, one arena of light trails',
  subtitle: () => <Trans>Outlast your rival on the grid.</Trans>,
  instructions,
  presentation: presentation(() => t`Light Cycles Duel`),
});

export const lightCyclesTrioClient = defineGameClient({
  shared: lightCyclesTrioShared,
  title: 'Light Cycles Trio',
  caption: 'Three riders, one arena of light trails',
  subtitle: () => <Trans>Be the last of three riders riding.</Trans>,
  instructions,
  presentation: presentation(() => t`Light Cycles Trio`),
});

export const lightCyclesQuadClient = defineGameClient({
  shared: lightCyclesQuadShared,
  title: 'Light Cycles Quad',
  caption: 'Four riders, one arena of light trails',
  subtitle: () => <Trans>Be the last of four riders riding.</Trans>,
  instructions,
  presentation: presentation(() => t`Light Cycles Quad`),
});
