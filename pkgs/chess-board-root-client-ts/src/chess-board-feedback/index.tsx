/** @jsxImportSource solid-js */
/**
 * Cell-feedback badges (checks, x marks, annotation glyphs) drawn in the
 * board-unit SVG layer.
 */

import { chessBoardLayerTestId } from '@pkgs/chess-board-core-shared-ts/probe';
import type {
  BoardOrientation,
  BoardTheme,
  CellFeedback,
  Square,
} from '@pkgs/chess-board-core-shared-ts/types';
import {
  BOARD_VIEW_BOX,
  fmtUnits,
} from '@pkgs/chess-board-root-shared-ts/board-units';
import type { FeedbackBadge } from '@pkgs/chess-board-root-shared-ts/feedback-badge';
import {
  BADGE_FONT_SIZE,
  BADGE_RADIUS,
  BADGE_RING_WIDTH,
  feedbackBadges,
  GLYPH_PATHS_100,
  glyphStyle,
  TEXT_GLYPH,
} from '@pkgs/chess-board-root-shared-ts/feedback-badge';
import { createMemo, For, type JSX, Show } from 'solid-js';
import styles from '../chess-board/chess-board.module.css';
import { PaintToken } from '../paint-token/index';

export type ChessBoardFeedbackProps = {
  readonly boardTestId: string;
  readonly orientation: BoardOrientation;
  readonly theme: BoardTheme;
  readonly cellFeedback: Partial<Record<Square, CellFeedback>> | undefined;
};

function FeedbackMark(props: {
  readonly badge: FeedbackBadge;
  readonly theme: BoardTheme;
}): JSX.Element {
  const color = () =>
    props.badge.feedback.color ??
    props.theme.feedback[props.badge.feedback.kind];
  const opacity = () => props.badge.feedback.opacity ?? 1;
  const scale = (BADGE_RADIUS * 2) / 100;
  const path = () =>
    props.badge.feedback.label === undefined
      ? GLYPH_PATHS_100[props.badge.feedback.kind]
      : undefined;
  const text = () =>
    props.badge.feedback.label ?? TEXT_GLYPH[props.badge.feedback.kind];
  return (
    <g
      opacity={opacity()}
      transform={`translate(${fmtUnits(props.badge.cx)} ${fmtUnits(props.badge.cy)})`}
    >
      <PaintToken
        kind="feedback"
        detail={props.badge.feedback.kind}
        at={props.badge.square}
      />
      <circle
        r={BADGE_RADIUS}
        fill={color()}
        stroke={props.theme.lightSquare}
        stroke-width={BADGE_RING_WIDTH}
      />
      <Show when={path()}>
        {(d) => (
          <path
            d={d()}
            transform={`translate(${-BADGE_RADIUS} ${-BADGE_RADIUS}) scale(${scale})`}
            fill={
              glyphStyle(props.badge.feedback.kind) === 'fill'
                ? props.theme.lightSquare
                : 'none'
            }
            stroke={
              glyphStyle(props.badge.feedback.kind) === 'stroke'
                ? props.theme.lightSquare
                : 'none'
            }
            stroke-width={10}
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        )}
      </Show>
      <Show when={text()}>
        {(label) => (
          <text
            text-anchor="middle"
            dominant-baseline="central"
            fill={props.theme.lightSquare}
            font-size={String(BADGE_FONT_SIZE)}
            font-weight={700}
            textLength={
              props.badge.feedback.label === undefined
                ? undefined
                : BADGE_RADIUS * 1.6
            }
            lengthAdjust="spacingAndGlyphs"
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
  const badges = createMemo(() =>
    feedbackBadges(props.cellFeedback, props.orientation)
  );
  // No badges, no layer: an empty full-board SVG above the pieces would
  // still be composited over every sliding piece.
  return (
    <Show when={badges().length > 0}>
      <svg
        class={`${styles['layer']} ${styles['svgLayer']} ${styles['feedback']}`}
        viewBox={BOARD_VIEW_BOX}
        aria-hidden="true"
        data-testid={chessBoardLayerTestId(props.boardTestId, 'feedback')}
      >
        <For each={[...badges()]}>
          {(badge) => <FeedbackMark badge={badge} theme={props.theme} />}
        </For>
      </svg>
    </Show>
  );
}
