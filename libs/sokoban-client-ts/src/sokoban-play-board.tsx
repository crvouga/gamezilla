import type {
  SokobanBoard,
  SokobanPosition,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import {
  TileBoard,
  type TileBoardDirection,
} from '@pkgs/ui-root-client-ts/tile-board';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import {
  positionPieces,
  sokobanPieces,
  sokobanTiles,
} from './sokoban-board-view';
import { useSokobanWords } from './use-sokoban-words';

type Props = {
  readonly board: SokobanBoard;
  readonly position: SokobanPosition;
  readonly describedBy: string;
  readonly onDirection: (direction: TileBoardDirection) => void;
  readonly onTile: (index: number) => void;
  /** Laid over the board's lower edge, so it never moves the controls below. */
  readonly overlay?: JSX.Element | undefined;
};

function createView(props: Props, closer: () => boolean) {
  const words = useSokobanWords();
  const frame = createMemo(() => {
    const columns = closer()
      ? Math.min(6, props.board.width)
      : props.board.width;
    const rows = closer()
      ? Math.min(6, props.board.height)
      : props.board.height;
    return {
      columns,
      rows,
      left: Math.max(
        0,
        Math.min(
          props.board.width - columns,
          props.position.worker.x - Math.floor(columns / 2)
        )
      ),
      top: Math.max(
        0,
        Math.min(
          props.board.height - rows,
          props.position.worker.y - Math.floor(rows / 2)
        )
      ),
    };
  });
  const indexInBoard = (index: number) =>
    (Math.floor(index / frame().columns) + frame().top) * props.board.width +
    (index % frame().columns) +
    frame().left;
  const tiles = createMemo(() => {
    const all = sokobanTiles(
      props.board,
      positionPieces(props.position),
      words
    );
    const bounds = frame();
    const width = props.board.width;
    return all.filter((_, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      return (
        x >= bounds.left &&
        x < bounds.left + bounds.columns &&
        y >= bounds.top &&
        y < bounds.top + bounds.rows
      );
    });
  });
  const pieces = createMemo(() =>
    sokobanPieces(props.board, positionPieces(props.position)).map((piece) => ({
      ...piece,
      column: piece.column - frame().left,
      row: piece.row - frame().top,
    }))
  );
  return { frame, tiles, pieces, indexInBoard };
}

/** A full-board overview with an optional readable view around the worker. */
export function SokobanPlayBoard(props: Props): JSX.Element {
  const { t } = useLingui();
  const [closer, setCloser] = createSignal(false);
  const canClose = () => props.board.width > 8 || props.board.height > 8;
  const closeView = () => canClose() && closer();
  const view = createView(props, closeView);
  return (
    <StackVertical gap="xs">
      <StackVertical>
        <TileBoard
          label={
            closeView()
              ? t`Sokoban board, close view around the worker`
              : t`Sokoban board`
          }
          testId="sokoban-board"
          size="fill"
          columns={view.frame().columns}
          rows={view.frame().rows}
          tiles={view.tiles()}
          pieces={view.pieces()}
          describedBy={props.describedBy}
          onDirection={props.onDirection}
          onTile={(index) => props.onTile(view.indexInBoard(index))}
        />
        {props.overlay}
      </StackVertical>
      <Show when={canClose()}>
        <Button
          title={closeView() ? t`Show whole board` : t`Look closer`}
          intent="neutral"
          variant="outline"
          onClick={() => setCloser((value) => !value)}
        />
        <Show when={closeView()}>
          <P variant="caption" tone="secondary" role="status">
            <Trans>
              Close view follows the worker. Show the whole board to see every
              crate and goal.
            </Trans>
          </P>
        </Show>
      </Show>
    </StackVertical>
  );
}
