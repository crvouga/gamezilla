/** @jsxImportSource solid-js */
/**
 * Cell-feedback badges (checks, x marks, annotation glyphs) drawn in the
 * board-unit SVG layer.
 */

import type {
  BoardOrientation,
  BoardTheme,
  CellFeedback,
  Square,
} from '@pkgs/chess-board-core/types';
import { For, type JSX, Show } from 'solid-js';

import { fmtUnits } from './board-units';
import styles from './chess-board.module.css';
import {
  BADGE_FONT_SIZE,
  BADGE_RADIUS,
  BADGE_RING_WIDTH,
  type FeedbackBadge,
  feedbackBadges,
  GLYPH_PATHS_100,
  glyphStyle,
  TEXT_GLYPH,
} from './feedback-badge';

export type ChessBoardFeedbackProps = {
  readonly orientation: BoardOrientation;
  readonly theme: BoardTheme;
  readonly cellFeedback: Partial<Record<Square, CellFeedback>> | undefined;
};

function FeedbackMark(props: {
  readonly badge: FeedbackBadge;
  readonly theme: BoardTheme;
}): JSX.Element {
  const { badge, theme } = props;
  const color = badge.feedback.color ?? theme.feedback[badge.feedback.kind];
  const opacity = badge.feedback.opacity ?? 1;
  const scale = (BADGE_RADIUS * 2) / 100;
  const path = GLYPH_PATHS_100[badge.feedback.kind];
  const text = TEXT_GLYPH[badge.feedback.kind];
  return (
    <g
      class={badge.feedback.pulse === true ? styles['pulse'] : undefined}
      opacity={opacity}
      transform={`translate(${fmtUnits(badge.cx)} ${fmtUnits(badge.cy)})`}
    >
      <circle
        r={BADGE_RADIUS}
        fill={color}
        stroke={theme.lightSquare}
        stroke-width={BADGE_RING_WIDTH}
      />
      <Show when={path}>
        {(d) => (
          <path
            d={d()}
            transform={`translate(${-BADGE_RADIUS} ${-BADGE_RADIUS}) scale(${scale})`}
            fill={
              glyphStyle(badge.feedback.kind) === 'fill'
                ? theme.lightSquare
                : 'none'
            }
            stroke={
              glyphStyle(badge.feedback.kind) === 'stroke'
                ? theme.lightSquare
                : 'none'
            }
            stroke-width={10}
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        )}
      </Show>
      <Show when={text}>
        {(label) => (
          <text
            text-anchor="middle"
            dominant-baseline="central"
            fill={theme.lightSquare}
            font-size={String(BADGE_FONT_SIZE)}
            font-weight={700}
          >
            {label()}
          </text>
        )}
      </Show>
    </g>
  );
}

export function ChessBoardFeedback(
  props: ChessBoardFeedbackProps
): JSX.Element {
  const badges = () => feedbackBadges(props.cellFeedback, props.orientation);
  return (
    <svg
      class={`${styles['layer']} ${styles['svgLayer']}`}
      viewBox="0 0 800 800"
      aria-hidden="true"
    >
      <For each={[...badges()]}>
        {(badge) => <FeedbackMark badge={badge} theme={props.theme} />}
      </For>
    </svg>
  );
}
