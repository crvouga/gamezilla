import type { GameClientPresentation } from '@libs/game-menu-client/game-client';
import { t } from '@lingui/core/macro';
import type { GameBoardProps } from '@pkgs/turn-game-shared/game-presentation';
import type { JSX } from 'solid-js';
import { ConnectFourBoard } from './connect-four-board';

function Board(props: GameBoardProps): JSX.Element {
  return (
    <ConnectFourBoard
      position={props.position}
      interactive={props.interactive}
      testId={props.testId}
      onDrop={(column) => props.onAction(String(column))}
    />
  );
}
export const connectFourPresentation: GameClientPresentation = {
  canFlip: false,
  name: () => t`Connect Four`,
  Board,
  sideLabel: (side) => (side === 'white' ? t`Red circle` : t`Yellow diamond`),
  endingDescription: (reason) => {
    const descriptions: Readonly<Record<string, string>> = {
      'four in a row': t`Four in a row.`,
      'full board': t`The board is full. Game drawn.`,
    };
    return descriptions[reason];
  },
  timeoutDrawDescription: (side) => {
    const flagged = side === 'white' ? t`Red circle` : t`Yellow diamond`;
    return t`${flagged} ran out of time, but the other side cannot win.`;
  },
  endingLabel: (reason) =>
    reason === 'four in a row' ? t`four in a row` : t`full board`,
};
