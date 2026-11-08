import type {
  SokobanBoard,
  SokobanPosition,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { Plural, Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import {
  TileBoard,
  type TileBoardDirection,
  type TileBoardTile,
} from '@pkgs/ui-root-client-ts/tile-board';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import {
  keepUnchangedTiles,
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
};

type Frame = {
  readonly columns: number;
  readonly rows: number;
  readonly left: number;
  readonly top: number;
};

/** What a close view hides: crates, and goals still waiting for one. */
function outsideView(
  board: SokobanBoard,
  position: SokobanPosition,
  bounds: Frame
): { readonly crates: number; readonly goals: number } {
  const hidden = (x: number, y: number) =>
    x < bounds.left ||
    x >= bounds.left + bounds.columns ||
    y < bounds.top ||
    y >= bounds.top + bounds.rows;
  const filled = new Set(
    position.crates.map((crate) => crate.y * board.width + crate.x)
  );
  let goals = 0;
  board.squares.forEach((square, index) => {
    const x = index % board.width;
    const y = Math.floor(index / board.width);
    if (square === 'goal' && !filled.has(index) && hidden(x, y)) goals += 1;
  });
  const crates = position.crates.filter((crate) =>
    hidden(crate.x, crate.y)
  ).length;
  return { crates, goals };
}

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
  const tiles = createMemo<readonly TileBoardTile[]>((previous) => {
    const all = sokobanTiles(
      props.board,
      positionPieces(props.position),
      words
    );
    const bounds = frame();
    const width = props.board.width;
    const shown = all.filter((_, index) => {
      const x = index % width;
      const y = Math.floor(index / width);
      return (
        x >= bounds.left &&
        x < bounds.left + bounds.columns &&
        y >= bounds.top &&
        y < bounds.top + bounds.rows
      );
    });
    return keepUnchangedTiles(previous, shown);
  });
  const pieces = createMemo(() =>
    sokobanPieces(props.board, positionPieces(props.position)).map((piece) => ({
      ...piece,
      column: piece.column - frame().left,
      row: piece.row - frame().top,
    }))
  );
  const outside = createMemo(() =>
    outsideView(props.board, props.position, frame())
  );
  return { frame, tiles, pieces, indexInBoard, outside };
}

/** A full-board overview with an optional readable view around the worker. */
export function SokobanPlayBoard(props: Props): JSX.Element {
  const { t } = useLingui();
  const [closer, setCloser] = createSignal(false);
  const canClose = () => props.board.width > 8 || props.board.height > 8;
  const closeView = () => canClose() && closer();
  const view = createView(props, closeView);
  return (
    <StackVertical gap="md">
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
      </StackVertical>
      <Show when={canClose()}>
        <Button
          title={closeView() ? t`Show whole board` : t`Look closer`}
          intent="neutral"
          variant="outline"
          size="sm"
          onClick={() => setCloser((value) => !value)}
        />
        <Show when={closeView()}>
          {/* Not a live region: the board's own label says it is the close
              view, and these counts change on many moves. */}
          <P
            variant="caption"
            tone="secondary"
            dataSet={{
              testid: 'sokoban-outside-view',
              crates: String(view.outside().crates),
              goals: String(view.outside().goals),
            }}
          >
            <Show
              when={view.outside().crates + view.outside().goals > 0}
              fallback={
                <Trans>
                  Close view follows the worker. Every crate and open goal is in
                  view.
                </Trans>
              }
            >
              <Trans>
                Close view follows the worker. Out of view:{' '}
                <Plural
                  value={view.outside().crates}
                  one="# crate"
                  other="# crates"
                />{' '}
                and{' '}
                <Plural
                  value={view.outside().goals}
                  one="# open goal"
                  other="# open goals"
                />
                .
              </Trans>
            </Show>
          </P>
        </Show>
      </Show>
    </StackVertical>
  );
}
