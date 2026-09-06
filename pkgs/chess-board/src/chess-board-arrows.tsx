/** @jsxImportSource solid-js */
/**
 * Annotation arrows in board-unit space. Colors resolve against
 * `theme.arrows` keys or pass through as raw CSS colors.
 */

import {
  ARROW_DEFAULT_OPACITY,
  arrowDashArray,
  arrowSvgPaths,
  boardArrowGeometry,
} from '@pkgs/chess-board-core/arrow-geometry';
import type {
  BoardArrow,
  BoardOrientation,
  BoardTheme,
} from '@pkgs/chess-board-core/types';
import { For, type JSX } from 'solid-js';

import { BOARD_UNITS } from './board-units';
import styles from './chess-board.module.css';

export type ChessBoardArrowsProps = {
  readonly orientation: BoardOrientation;
  readonly theme: BoardTheme;
  readonly arrows: readonly BoardArrow[];
};

function resolveArrowColor(
  theme: BoardTheme,
  color: string | undefined
): string {
  if (color === undefined) return theme.arrows.primary;
  const keyed = theme.arrows[color as keyof typeof theme.arrows];
  return keyed ?? color;
}

export function ChessBoardArrows(props: ChessBoardArrowsProps): JSX.Element {
  return (
    <svg
      class={`${styles['layer']} ${styles['svgLayer']}`}
      viewBox={`0 0 ${BOARD_UNITS} ${BOARD_UNITS}`}
      aria-hidden="true"
    >
      <For each={[...props.arrows]}>
        {(arrow, i) => {
          const g = boardArrowGeometry(arrow, BOARD_UNITS, props.orientation);
          const paths = arrowSvgPaths(g);
          const color = resolveArrowColor(props.theme, arrow.color);
          const opacity = arrow.opacity ?? ARROW_DEFAULT_OPACITY;
          const dash =
            arrow.dashed === true
              ? arrowDashArray(g.thickness).join(' ')
              : undefined;
          return (
            <g opacity={opacity}>
              <path
                d={paths.shaftD}
                fill="none"
                stroke={color}
                stroke-width={g.thickness}
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-dasharray={dash}
              />
              <path d={paths.headD} fill={color} />
              {/* key via index+endpoints for stable For identity */}
              <title>{`arrow-${i()}-${arrow.from}-${arrow.to}`}</title>
            </g>
          );
        }}
      </For>
    </svg>
  );
}
