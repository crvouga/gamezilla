/** @jsxImportSource solid-js */
/**
 * Circle marks + arrow layer for user/external {@link BoardShape}s.
 */

import type { BoardShape } from '@pkgs/chess-board-core/shapes/board-shapes';
import type {
  BoardArrow,
  BoardOrientation,
  BoardTheme,
} from '@pkgs/chess-board-core/types';
import { For, type JSX, Show } from 'solid-js';
import { BOARD_UNITS, CELL_UNITS, squareOrigin } from './board-units';
import styles from './chess-board.module.css';
import { ChessBoardArrows } from './chess-board-arrows';

export type ChessBoardShapesProps = {
  readonly orientation: BoardOrientation;
  readonly theme: BoardTheme;
  readonly shapes: readonly BoardShape[];
  readonly arrows: readonly BoardArrow[];
};

function resolveColor(theme: BoardTheme, color: string): string {
  const palette: Record<string, string | undefined> = theme.arrows;
  return palette[color] ?? color;
}

export function ChessBoardShapes(props: ChessBoardShapesProps): JSX.Element {
  const circles = () =>
    props.shapes.filter(
      (s): s is Extract<BoardShape, { kind: 'circle' }> => s.kind === 'circle'
    );
  return (
    <>
      <svg
        class={`${styles['layer']} ${styles['svgLayer']}`}
        viewBox={`0 0 ${BOARD_UNITS} ${BOARD_UNITS}`}
        aria-hidden="true"
      >
        <For each={[...circles()]}>
          {(c) => {
            const origin = () => squareOrigin(c.square, props.orientation);
            return (
              <circle
                cx={origin().x + CELL_UNITS / 2}
                cy={origin().y + CELL_UNITS / 2}
                r={CELL_UNITS * 0.42}
                fill="none"
                stroke={resolveColor(props.theme, c.color)}
                stroke-width={CELL_UNITS * 0.08}
                opacity={0.85}
              />
            );
          }}
        </For>
      </svg>
      <Show when={props.arrows.length > 0 || true}>
        <ChessBoardArrows
          orientation={props.orientation}
          theme={props.theme}
          arrows={props.arrows}
        />
      </Show>
    </>
  );
}
