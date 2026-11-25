import {
  decodeConnectFour,
  landingCell,
  replayConnectFour,
} from '@libs/connect-four-shared-ts/connect-four';
import { t } from '@lingui/core/macro';
import { DiscDropBoard } from '@pkgs/ui-root-client-ts/disc-drop-board';
import type { JSX } from '@solidjs/web';
import { createMemo } from 'solid-js';

/**
 * The line under the board. A finished board keeps its prompt line's room
 * (empty), so the board never resizes or moves when the game ends. A draw
 * offered to the person is answered first, though their move declines it.
 */
function boardPrompt(
  finished: boolean,
  interactive: boolean,
  drawToAnswer: boolean
): string {
  if (finished || !interactive) return '';
  return drawToAnswer
    ? t`Answer the draw offer, or drop a disc to play on`
    : t`Pick a column to drop your disc`;
}

export function ConnectFourBoard(props: {
  position: string;
  interactive: boolean;
  drawToAnswer?: boolean;
  testId: string;
  onDrop: (column: number) => void;
}): JSX.Element {
  const game = createMemo(() => decodeConnectFour(props.position));
  const lastCell = createMemo(() => {
    const moves = game().moves;
    const column = moves.at(-1);
    if (column === undefined) return undefined;
    return (
      landingCell(replayConnectFour(moves.slice(0, -1)), column) ?? undefined
    );
  });
  return (
    <DiscDropBoard
      testId={props.testId}
      columnTestId={(column) => `${props.testId}-column-${column + 1}`}
      cells={game().board}
      columns={7}
      rows={6}
      active={game().turn}
      winning={game().winning}
      lastCell={lastCell()}
      interactive={props.interactive && game().result === 0}
      finished={game().result !== 0}
      label={t`Connect Four board, seven columns and six rows`}
      prompt={boardPrompt(
        game().result !== 0,
        props.interactive,
        props.drawToAnswer === true
      )}
      previewPrompt={(column) => t`Drop in column ${column + 1}`}
      fullColumnPrompt={(column) =>
        t`Column ${column + 1} is full. Choose another column.`
      }
      keyboardHelp={
        props.interactive && game().result === 0
          ? t`Left/Right to choose · Enter or Space drops`
          : t`Left/Right to inspect columns`
      }
      cellLabel={(column, row, disc) => {
        const identity =
          disc === 1
            ? t`Red circle`
            : disc === 2
              ? t`Yellow diamond`
              : t`Empty`;
        return game().winning.includes(row * 7 + column)
          ? t`Column ${column + 1}, row ${row + 1}: ${identity}, winning disc`
          : t`Column ${column + 1}, row ${row + 1}: ${identity}`;
      }}
      columnLabel={(column, occupied, full) =>
        full
          ? t`Column ${column + 1}, full`
          : props.interactive && game().result === 0
            ? t`Drop in column ${column + 1}, ${occupied} of 6 occupied`
            : t`Column ${column + 1}, ${occupied} of 6 occupied`
      }
      onDrop={props.onDrop}
    />
  );
}
