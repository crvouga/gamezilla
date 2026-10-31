/** @jsxImportSource solid-js */
/**
 * Annotation arrows in board-unit space. Colors resolve against
 * `theme.arrows` keys or pass through as raw CSS colors. The arrow being
 * right-dragged is drawn live (lighter) until it is committed.
 */

import {
  ARROW_DEFAULT_OPACITY,
  arrowDashArray,
  arrowSvgPaths,
  boardArrowGeometry,
} from '@pkgs/chess-board-core-shared-ts/arrow-geometry';
import { chessBoardLayerTestId } from '@pkgs/chess-board-core-shared-ts/probe';
import type {
  BoardArrow,
  BoardOrientation,
  BoardTheme,
} from '@pkgs/chess-board-core-shared-ts/types';
import {
  BOARD_UNITS,
  BOARD_VIEW_BOX,
} from '@pkgs/chess-board-root-shared-ts/board-units';
import { type Accessor, createMemo, For, type JSX, Show } from 'solid-js';
import styles from '../chess-board/chess-board.module.css';
import type { ShapePreview } from '../chess-board-user-shapes';
import { PaintToken } from '../paint-token/index';

export type ChessBoardArrowsProps = {
  readonly boardTestId: string;
  readonly orientation: Accessor<BoardOrientation>;
  readonly theme: Accessor<BoardTheme>;
  readonly arrows: Accessor<readonly BoardArrow[]>;
  readonly preview: Accessor<ShapePreview | null>;
};

/** A preview reads as "not yet drawn". */
const PREVIEW_OPACITY = 0.5;

export function resolveArrowColor(
  theme: BoardTheme,
  color: string | undefined
): string {
  if (color === undefined) return theme.arrows.primary;
  const palette: Record<string, string | undefined> = theme.arrows;
  return palette[color] ?? color;
}

function Arrow(props: {
  readonly arrow: BoardArrow;
  readonly orientation: Accessor<BoardOrientation>;
  readonly theme: Accessor<BoardTheme>;
  readonly token: 'arrow' | 'arrow-preview';
  readonly opacity?: number;
}): JSX.Element {
  // Geometry follows the orientation: a flip redraws the arrow.
  const geometry = createMemo(() =>
    boardArrowGeometry(props.arrow, BOARD_UNITS, props.orientation())
  );
  const paths = createMemo(() => arrowSvgPaths(geometry()));
  const color = () => resolveArrowColor(props.theme(), props.arrow.color);
  const dash = () =>
    props.arrow.dashed === true
      ? arrowDashArray(geometry().thickness).join(' ')
      : undefined;
  return (
    <g opacity={props.opacity ?? props.arrow.opacity ?? ARROW_DEFAULT_OPACITY}>
      <path
        d={paths().shaftD}
        fill="none"
        stroke={color()}
        stroke-width={geometry().thickness}
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-dasharray={dash()}
      />
      <path d={paths().headD} fill={color()} />
      <PaintToken
        kind={props.token}
        detail={props.arrow.color ?? 'primary'}
        at={`${props.arrow.from}-${props.arrow.to}`}
      />
    </g>
  );
}

export function ChessBoardArrows(props: ChessBoardArrowsProps): JSX.Element {
  return (
    <Show when={props.arrows().length > 0 || props.preview() !== null}>
      <svg
        class={`${styles['layer']} ${styles['svgLayer']} ${styles['shapes']}`}
        viewBox={BOARD_VIEW_BOX}
        aria-hidden="true"
        data-testid={chessBoardLayerTestId(props.boardTestId, 'arrows')}
      >
        <For each={props.arrows()}>
          {(arrow) => (
            <Arrow
              arrow={arrow}
              orientation={props.orientation}
              theme={props.theme}
              token="arrow"
            />
          )}
        </For>
        <Show when={props.preview()} keyed>
          {(p) => (
            <Arrow
              arrow={{ from: p.from, to: p.to, color: p.color }}
              orientation={props.orientation}
              theme={props.theme}
              token="arrow-preview"
              opacity={PREVIEW_OPACITY}
            />
          )}
        </Show>
      </svg>
    </Show>
  );
}
