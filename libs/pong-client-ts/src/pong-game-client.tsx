import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { pongGameShared } from '@libs/pong-shared-ts/pong-game';
import { t } from '@lingui/core/macro';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { PongBoard } from './pong-board';
import { pongFrame } from './pong-frame';
import { pongLesson } from './pong-lesson';

export const pongGameClient = defineGameClient({
  shared: pongGameShared,
  title: 'Pong',
  caption: 'Keep the rally alive with friends or bots',
  tile: 'court',
  subtitle: () => <Trans>Two paddles. One ball. Every return counts.</Trans>,
  lesson: pongLesson,
  presentation: {
    name: () => t`Pong`,
    goal: () => t`Get the ball past the other paddle. First to the score wins.`,
    canFlip: false,
    Board: PongBoard,
    sideLabel: (side) => (side === 'white' ? t`Left` : t`Right`),
    frame: pongFrame,
    endingDescription: (reason) =>
      reason === 'score target' ? t`The score target was reached.` : undefined,
    endingLabel: (reason) =>
      reason === 'score target' ? t`score target` : reason,
  },
});
