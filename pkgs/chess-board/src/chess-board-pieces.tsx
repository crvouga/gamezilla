/** @jsxImportSource solid-js */
/**
 * Piece layer: stable-id rows slide via CSS `transform`; the capture ghost
 * fades at the vacated square; the dragged piece follows the pointer in
 * board units.
 */

import type { CaptureGhost } from '@pkgs/chess-board-core/capture-ghost';
import type { ChessPieceRow } from '@pkgs/chess-board-core/piece-rows';
import type {
  BoardOrientation,
  PieceCode,
  Square,
} from '@pkgs/chess-board-core/types';
import { type Accessor, For, type JSX, Show } from 'solid-js';

import { BOARD_UNITS, CELL_UNITS, squareOrigin } from './board-units';
import styles from './chess-board.module.css';
import { PIECE_IMAGE_URIS } from './piece-images';

export type ChessBoardPiecesProps = {
  readonly orientation: BoardOrientation;
  readonly rows: Accessor<readonly ChessPieceRow[]>;
  readonly captureGhost: Accessor<CaptureGhost | null>;
  readonly snapSquare: Accessor<Square | null>;
  readonly dragFrom: Accessor<Square | null>;
  /** Pointer position in board units, or null when not dragging. */
  readonly dragAt: Accessor<{ x: number; y: number } | null>;
  readonly animated: Accessor<boolean>;
};

function pieceTransform(square: Square, orientation: BoardOrientation): string {
  const { x, y } = squareOrigin(square, orientation);
  return `translate(${x} ${y})`;
}

function PieceImage(props: {
  readonly code: PieceCode;
  readonly opacity?: number | undefined;
  readonly class?: string | undefined;
}): JSX.Element {
  return (
    <image
      href={PIECE_IMAGE_URIS[props.code]}
      width={CELL_UNITS}
      height={CELL_UNITS}
      opacity={props.opacity ?? 1}
      class={props.class}
      style={{ 'pointer-events': 'none' }}
    />
  );
}

export function ChessBoardPieces(props: ChessBoardPiecesProps): JSX.Element {
  return (
    <svg
      class={`${styles['layer']} ${styles['svgLayer']}`}
      viewBox={`0 0 ${BOARD_UNITS} ${BOARD_UNITS}`}
      aria-hidden="true"
    >
      <Show when={props.captureGhost()}>
        {(ghost) => (
          <g transform={pieceTransform(ghost().square, props.orientation)}>
            <PieceImage code={ghost().code} opacity={0.45} />
          </g>
        )}
      </Show>
      <For each={props.rows()}>
        {(row) => {
          const dragging = () => props.dragFrom() === row.square;
          const at = () => props.dragAt();
          const transform = () => {
            if (dragging() && at() !== null) {
              const p = at()!;
              return `translate(${p.x - CELL_UNITS / 2} ${p.y - CELL_UNITS / 2})`;
            }
            return pieceTransform(row.square, props.orientation);
          };
          const className = () => {
            const parts = [styles['piece']];
            if (
              props.animated() &&
              props.snapSquare() !== row.square &&
              !dragging()
            ) {
              parts.push(styles['pieceAnimated']);
            }
            if (row.fadeIn === true && props.animated()) {
              parts.push(styles['pieceFadeIn']);
            }
            return parts.join(' ');
          };
          return (
            <g transform={transform()} class={className()}>
              <PieceImage code={row.code} />
            </g>
          );
        }}
      </For>
    </svg>
  );
}
