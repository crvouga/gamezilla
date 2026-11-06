import type { BoardTheme } from '@pkgs/chess-board-core-shared-ts/types';
import type { FeedbackBadge } from '@pkgs/chess-board-root-shared-ts/feedback-badge';
import type { JSX } from 'solid-js';
import { PaintToken } from '../paint-token/index';

/** Two contrasting perimeter strokes leave the entire piece silhouette clear. */
export function FeedbackOutline(props: {
  readonly badge: FeedbackBadge;
  readonly theme: BoardTheme;
  readonly origin: { x: number; y: number };
  readonly size: number;
}): JSX.Element {
  return (
    <g opacity={props.badge.feedback.opacity ?? 1}>
      <PaintToken kind="feedback" detail="outline" at={props.badge.square} />
      <rect
        x={props.origin.x + 4}
        y={props.origin.y + 4}
        width={props.size - 8}
        height={props.size - 8}
        fill="none"
        stroke={props.theme.lightSquare}
        stroke-width={8}
      />
      <rect
        x={props.origin.x + 4}
        y={props.origin.y + 4}
        width={props.size - 8}
        height={props.size - 8}
        fill="none"
        stroke={
          props.badge.feedback.color ??
          props.theme.feedback[props.badge.feedback.kind]
        }
        stroke-width={4}
      />
    </g>
  );
}
