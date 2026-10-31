/** @jsxImportSource solid-js */
/**
 * Circle marks + the arrow layer for user / parent shapes.
 */

import type { BoardShape } from '@pkgs/chess-board-core-shared-ts/board-shapes';
import { chessBoardLayerTestId } from '@pkgs/chess-board-core-shared-ts/probe';
import type {
  BoardArrow,
  BoardOrientation,
  BoardTheme,
} from '@pkgs/chess-board-core-shared-ts/types';
import {
  BOARD_VIEW_BOX,
  CELL_UNITS,
  squareOrigin,
} from '@pkgs/chess-board-root-shared-ts/board-units';
import { type Accessor, createMemo, For, type JSX, Show } from 'solid-js';
import styles from '../chess-board/chess-board.module.css';
import {
  ChessBoardArrows,
  resolveArrowColor,
} from '../chess-board-arrows/index';
import type { ShapePreview } from '../chess-board-user-shapes';
import { PaintToken } from '../paint-token/index';

export type ChessBoardShapesProps = {
  readonly boardTestId: string;
  readonly orientation: Accessor<BoardOrientation>;
  readonly theme: Accessor<BoardTheme>;
  readonly shapes: Accessor<readonly BoardShape[]>;
  readonly arrows: Accessor<readonly BoardArrow[]>;
  readonly preview: Accessor<ShapePreview | null>;
};

type Circle = Extract<BoardShape, { kind: 'circle' }>;

export function ChessBoardShapes(props: ChessBoardShapesProps): JSX.Element {
  const circles = createMemo(() =>
    props.shapes().filter((s): s is Circle => s.kind === 'circle')
  );
  return (
    <>
      {/* Only when there are circles: an empty layer above the pieces would
          still be composited over every sliding piece. */}
      <Show when={circles().length > 0}>
        <svg
          class={`${styles['layer']} ${styles['svgLayer']} ${styles['shapes']}`}
          viewBox={BOARD_VIEW_BOX}
          aria-hidden="true"
          data-testid={chessBoardLayerTestId(props.boardTestId, 'shapes')}
        >
          <For each={circles()}>
            {(c) => {
              const origin = () => squareOrigin(c.square, props.orientation());
              return (
                <circle
                  cx={origin().x + CELL_UNITS / 2}
                  cy={origin().y + CELL_UNITS / 2}
                  r={CELL_UNITS * 0.46}
                  fill="none"
                  stroke={resolveArrowColor(props.theme(), c.color)}
                  stroke-width={CELL_UNITS * 0.07}
                  opacity={0.85}
                >
                  <PaintToken kind="circle" detail={c.color} at={c.square} />
                </circle>
              );
            }}
          </For>
        </svg>
      </Show>
      <ChessBoardArrows
        boardTestId={props.boardTestId}
        orientation={props.orientation}
        theme={props.theme}
        arrows={props.arrows}
        preview={props.preview}
      />
    </>
  );
}
