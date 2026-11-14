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
  caption: 'Two players. Reach the opposite home row.',
  tile: 'walls',
  subtitle: () => (
    <Trans>Race your pawn across the board. Shape the path with walls.</Trans>
  ),
  instructions: [
    {
      key: 'goal',
      title: () => <Trans>Goal</Trans>,
      body: () => <Trans>Be first to reach the opposite home row.</Trans>,
    },
    {
      key: 'start',
      title: () => <Trans>The start</Trans>,
      body: () => (
        <Trans>
          Two players start on e1 and e9 with ten walls each. South moves first.
        </Trans>
      ),
    },
    {
      key: 'turn',
      title: () => <Trans>Your turn</Trans>,
      body: () => (
        <Trans>
          Move one square or place one wall. Jump one adjacent pawn; if the
          landing is blocked, move to its side.
        </Trans>
      ),
    },
    {
      key: 'walls',
      title: () => <Trans>Walls</Trans>,
      body: () => (
        <Trans>
          Walls span two boundaries and cannot cross, overlap or close anyone's
          last path.
        </Trans>
      ),
    },
  ],
  presentation: presentation(false),
});

export const quoridorHillGameClient = defineGameClient({
  shared: quoridorHillGameShared,
  title: 'Quoridor: King of the Hill',
  caption: 'Four players. First to the center hill (e5) wins.',
  tile: 'walls',
  subtitle: () => (
    <Trans>Move your pawn to the center hill (e5) first to win.</Trans>
  ),
  instructions: [
    {
      key: 'goal',
      title: () => <Trans>Goal</Trans>,
      body: () => (
        <Trans>
          Reach the center hill (e5). Reaching it wins immediately; there is no
          holding period.
        </Trans>
      ),
    },
    {
      key: 'start',
      title: () => <Trans>The start</Trans>,
      body: () => (
        <Trans>
          This hill variant uses a nine-by-nine board and five walls per player.
          South starts at e1, West at a5, North at e9 and East at i5. Turns run
          in that clockwise order.
        </Trans>
      ),
    },
    {
      key: 'turn',
      title: () => <Trans>Your turn</Trans>,
      body: () => (
        <Trans>
          Move or place a wall; jump one pawn, never a chain. A blocked landing
          allows a side-step. If no pawn move or wall is legal, pass when
          offered; you cannot pass otherwise.
        </Trans>
      ),
    },
    {
      key: 'walls',
      title: () => <Trans>Walls and draws</Trans>,
      body: () => (
        <Trans>
          Walls must keep everyone's path to the hill open. A withdrawal or
          expired clock ends the round as a draw.
        </Trans>
      ),
    },
  ],
  presentation: presentation(true),
});
