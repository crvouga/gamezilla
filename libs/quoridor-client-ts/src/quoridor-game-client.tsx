import {
  defineGameClient,
  type GameClientPresentation,
} from '@libs/game-menu-client-ts/game-client';
import {
  quoridorGameShared,
  quoridorHillGameShared,
} from '@libs/quoridor-shared-ts/quoridor-game';
import { t } from '@lingui/core/macro';
import { Trans } from '@lingui/solid/macro';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { QuoridorBoard } from './quoridor-board';
import { quoridorFrame } from './quoridor-frame';

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
    Board: QuoridorBoard,
    sideLabel: (side) => sideLabel(side, hill),
    frame: quoridorFrame(hill),
    endingDescription: (reason) =>
      reason === 'hill reached'
        ? t`The central hill was reached. Game won.`
        : reason === 'opposite row reached'
          ? t`The opposite home row was reached. Game won.`
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
  caption: 'Two players. Reach the opposite home row.',
  subtitle: () => (
    <Trans>Race your pawn across the board. Shape the path with walls.</Trans>
  ),
  instructions: () => (
    <Trans>
      Two players start on e1 and e9 with ten walls each. South moves first.
      Move one square or place one wall each turn. Jump one adjacent pawn; if
      the landing is blocked, move to its side. Walls span two boundaries and
      cannot cross, overlap or close anyone's last path. The first to reach the
      opposite home row wins.
    </Trans>
  ),
  presentation: presentation(false),
});

export const quoridorHillGameClient = defineGameClient({
  shared: quoridorHillGameShared,
  title: 'Quoridor: King of the Hill',
  caption: 'Four players. First to the central hill wins.',
  subtitle: () => (
    <Trans>Four sides. One hill. First to e5 wins immediately.</Trans>
  ),
  instructions: () => (
    <Trans>
      This hill variant uses a nine-by-nine board and five walls per player.
      South starts at e1, West at a5, North at e9 and East at i5. Turns run in
      that clockwise order. Move or place a wall; jump one pawn, never a chain.
      A blocked landing allows a side-step. Walls must keep everyone's path to
      e5 open. Reaching e5 wins immediately; no holding period. A withdrawal or
      expired clock ends the round as a draw. If no pawn move or wall is legal,
      pass when offered; you cannot pass otherwise.
    </Trans>
  ),
  presentation: presentation(true),
});
