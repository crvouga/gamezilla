import {
  COLUMNS,
  decodeConnectFour,
  landingCell,
  ROWS,
} from '@libs/connect-four-shared-ts/connect-four';
import { t } from '@lingui/core/macro';
import { DiscDropBoard } from '@pkgs/ui-root-client-ts/disc-drop-board';
import type { JSX } from '@solidjs/web';
import { createMemo } from 'solid-js';

export function ConnectFourBoard(props: {
  position: string;
  interactive: boolean;
  testId: string;
  /** As `GameBoardProps.steadyStatus`: a finished board keeps its status line's room. */
  steadyStatus?: boolean | undefined;
  onDrop: (column: number) => void;
}): JSX.Element {
  const game = createMemo(() => decodeConnectFour(props.position));
  const lastCell = createMemo(() => {
    const position = game();
    const column = position.moves.at(-1);
    if (column === undefined) return undefined;
    const next = landingCell(position, column) ?? ROWS * COLUMNS + column;
    return next - COLUMNS;
  });
  return (
    <DiscDropBoard
      testId={props.testId}
      columnTestId={(column) => `${props.testId}-column-${column + 1}`}
      cells={game().board}
      columns={COLUMNS}
      rows={ROWS}
      active={game().turn}
      winning={game().winning}
      lastCell={lastCell()}
      interactive={props.interactive && game().result === 0}
      finished={game().result !== 0}
      label={t`Connect Four board, seven columns and six rows`}
      prompt={
        game().result !== 0
          ? props.steadyStatus === true
            ? ''
            : undefined
          : props.interactive
            ? t`Pick a column to drop your disc`
            : ''
      }
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
