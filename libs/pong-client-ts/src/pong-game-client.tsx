import { defineGameClient } from '@libs/game-menu-client-ts/game-client';
import { pongGameShared } from '@libs/pong-shared-ts/pong-game';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import { PongBoard } from './pong-board';
import { pongFrame } from './pong-frame';

export const pongGameClient = defineGameClient({
  shared: pongGameShared,
  title: 'Pong',
  caption: 'Keep the rally alive with friends or bots',
  subtitle: () => <Trans>Two paddles. One ball. Every return counts.</Trans>,
  instructions: () => (
    <Trans>
      Move your paddle to return the ball. A ball past the other paddle scores a
      point. Reach the chosen score to win. Play with a bot, share a device,
      invite someone, or find an opponent.
    </Trans>
  ),
  presentation: {
    name: () => t`Pong`,
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
