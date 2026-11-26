import {
  defineGameClient,
  type GameClientPresentation,
} from '@libs/game-menu-client-ts/game-client';
import {
  quoridorGameShared,
  quoridorHillGameShared,
} from '@libs/quoridor-shared-ts/quoridor-game';
import { t } from '@lingui/core/macro';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { QuoridorBoard } from './quoridor-board';
import { quoridorFrame } from './quoridor-frame';
import { quoridorLesson } from './quoridor-lesson';

function sideLabel(side: GameSide, hill: boolean): string {
  if (side === 'white') return t`South red circle`;
  if (side === 'black')
    return hill ? t`West gold diamond` : t`North gold diamond`;
  return side === 'red' ? t`North green triangle` : t`East black square`;
}

function presentation(hill: boolean): GameClientPresentation {
  return {
    canFlip: false,
    name: () => (hill ? t`Quoridor: King of the Hill` : t`Classic Quoridor`),
    goal: () =>
      hill
        ? t`Reach the central hill first. Walls slow the others down.`
        : t`Reach the opposite home row first. Walls slow the others down.`,
    Board: QuoridorBoard,
    sideLabel: (side) => sideLabel(side, hill),
    frame: quoridorFrame(hill),
    // The headline names the winner; this line is read by the loser too.
    endingDescription: (reason) =>
      reason === 'hill reached'
        ? t`The central hill was reached.`
        : reason === 'opposite row reached'
          ? t`The opposite home row was reached.`
          : undefined,
    timeoutDrawDescription: (side) => {
      const name = sideLabel(side, hill);
      return t`${name} ran out of time. Game drawn.`;
    },
    endingLabel: (reason) =>
      reason === 'hill reached' ? t`hill reached` : t`opposite row reached`,
  };
}

export const quoridorGameClient = defineGameClient({
  shared: quoridorGameShared,
  title: 'Classic Quoridor',
  mode: { game: 'Quoridor', name: 'Classic' },
  caption: 'Two players. Reach the opposite home row.',
  tile: 'walls',
  subtitle: () => (
    <Trans>Race your pawn across the board. Shape the path with walls.</Trans>
  ),
  lesson: quoridorLesson(false),
  presentation: presentation(false),
});

export const quoridorHillGameClient = defineGameClient({
  shared: quoridorHillGameShared,
  title: 'Quoridor: King of the Hill',
  mode: { game: 'Quoridor', name: 'King of the Hill' },
  caption: 'Four players. First to the center hill (e5) wins.',
  tile: 'walls',
  subtitle: () => (
    <Trans>Move your pawn to the center hill (e5) first to win.</Trans>
  ),
  lesson: quoridorLesson(true),
  presentation: presentation(true),
});
