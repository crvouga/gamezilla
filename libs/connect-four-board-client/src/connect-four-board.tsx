import {
  decodeConnectFour,
  landingCell,
  replayConnectFour,
} from '@libs/connect-four-shared/connect-four';
import { t } from '@lingui/core/macro';
import { DiscDropBoard } from '@pkgs/ui-root-client/disc-drop-board';
import { createMemo, type JSX } from 'solid-js';

export function ConnectFourBoard(props: {
  position: string;
  interactive: boolean;
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
      emptyLabel={t`Empty`}
      testId="connect-four-board"
      columnTestId={(column) => `connect-four-column-${column + 1}`}
      cells={game().board}
      columns={7}
      rows={6}
      active={game().turn}
      winning={game().winning}
      lastCell={lastCell()}
      interactive={props.interactive && game().result === 0}
      identities={[t`Red circle`, t`Yellow diamond`]}
      label={t`Connect Four board, seven columns and six rows`}
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
