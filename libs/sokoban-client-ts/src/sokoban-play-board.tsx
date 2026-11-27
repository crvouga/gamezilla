import type {
  SokobanBoard,
  SokobanPosition,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { Plural, Trans, useLingui } from '@pkgs/lingui-solid-client-ts/macro';
import { WarehouseFit } from '@pkgs/sokoban-board-client-ts/fit';
import { useWarehouseGestures } from '@pkgs/sokoban-board-client-ts/gestures';
import { warehouseArt } from '@pkgs/sokoban-board-client-ts/piece';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import {
  TileBoard,
  type TileBoardDirection,
  type TileBoardPiece,
} from '@pkgs/ui-root-client-ts/tile-board';
import type { JSX } from '@solidjs/web';
import { createMemo, createSignal, Show } from 'solid-js';
import {
  type BoardWindow,
  cellOf,
  createSokobanTiles,
  followAxis,
  indexInWindow,
  sokobanPieces,
} from './sokoban-board-view';
import { useSokobanWords } from './use-sokoban-words';

type Props = {
  readonly board: SokobanBoard;
  readonly position: SokobanPosition;
  readonly describedBy: string;
  readonly onDirection: (direction: TileBoardDirection) => void;
  readonly onTile: (index: number) => void;
};

function createView(props: Props, closer: () => boolean) {
  const words = useSokobanWords();
  const board = createMemo(() => props.board);
  const frame = createMemo<BoardWindow>((previous) => {
    const layout = board();
    const columns = closer() ? Math.min(6, layout.width) : layout.width;
    const rows = closer() ? Math.min(6, layout.height) : layout.height;
    // A window of a different size (closer turned on or off) starts afresh.
    const same = previous?.columns === columns && previous.rows === rows;
    const left = followAxis(
      same ? previous.left : undefined,
      columns,
      layout.width,
      props.position.worker.x
    );
    const top = followAxis(
      same ? previous.top : undefined,
      rows,
      layout.height,
      props.position.worker.y
    );
    if (same && previous.left === left && previous.top === top) return previous;
    return { columns, rows, left, top };
  });
  const indexInBoard = (index: number) =>
    (Math.floor(index / frame().columns) + frame().top) * props.board.width +
    (index % frame().columns) +
    frame().left;
  const placePieces = createMemo(() =>
    createSokobanTiles(board(), words, frame())
  );
  const tiles = createMemo(() => placePieces()(props.position));
  const pieces = createMemo<readonly TileBoardPiece[]>((previous) =>
    sokobanPieces(board(), props.position).map((piece, index) => {
      const column = piece.column - frame().left;
      const row = piece.row - frame().top;
      const prior = previous?.[index];
      if (
        prior?.id === piece.id &&
        prior.tone === piece.tone &&
        prior.column === column &&
        prior.row === row
      )
        return prior;
      return { ...piece, art: warehouseArt[piece.tone], column, row };
    })
  );
  const hiddenGoals = createMemo(() => {
    const layout = board();
    const shown = frame();
    if (shown.columns === layout.width && shown.rows === layout.height)
      return 0;
    return layout.squares.reduce(
      (count, square, index) =>
        square === 'goal' && indexInWindow(cellOf(layout, index), shown) < 0
          ? count + 1
          : count,
      0
    );
  });
  const outside = createMemo(() => {
    const layout = board();
    const shown = frame();
    let goals = hiddenGoals();
    let crates = 0;
    for (const crate of props.position.crates) {
      if (indexInWindow(crate, shown) >= 0) continue;
      crates++;
      if (layout.squares[crate.y * layout.width + crate.x] === 'goal') goals--;
    }
    return { crates, goals };
  });
  return { frame, tiles, pieces, indexInBoard, outside };
}

/** A full-board overview with an optional readable view around the worker. */
export function SokobanPlayBoard(props: Props): JSX.Element {
  const { t } = useLingui();
  const [closer, setCloser] = createSignal(false);
  const canClose = () => props.board.width > 8 || props.board.height > 8;
  const closeView = () => canClose() && closer();
  const view = createView(props, closeView);
  const tap = (index: number) => props.onTile(view.indexInBoard(index));
  const gestures = useWarehouseGestures({
    puzzle: () => props.board,
    columns: () => view.frame().columns,
    rows: () => view.frame().rows,
    step: (direction) => props.onDirection(direction),
    tap,
  });
  return (
    <StackVertical
      gap="md"
      dataSet={{ 'warehouse-views': canClose() ? 'multiple' : 'single' }}
    >
      <StackVertical>
        <TileBoard
          boardTheme="warehouse"
          bindPointerInput={gestures.bind}
          boardTool={<WarehouseFit label={t`Fit board`} onFit={gestures.fit} />}
          inputDescription={t`Swipe to step. Pinch or hold to zoom. Drag to pan when zoomed. Hold again to fit. Use + or - to zoom, Shift and arrow keys to pan, and 0 to fit.`}
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
          onTile={tap}
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
