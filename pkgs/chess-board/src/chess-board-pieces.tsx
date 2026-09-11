/** @jsxImportSource solid-js */
/**
 * Piece layer: stable-id rows slide via CSS `transform`; the capture ghost
 * fades at the vacated square; the dragged piece follows the pointer with a
 * lift scale, and a faint origin ghost stays on the from-square.
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
  readonly premoveTo: Square | null;
  readonly premoveCode: PieceCode | null;
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
          <g
            class={styles['captureGhost']}
            transform={pieceTransform(ghost().square, props.orientation)}
          >
            <PieceImage code={ghost().code} />
          </g>
        )}
      </Show>
      <Show
        when={
          props.premoveTo !== null && props.premoveCode !== null
            ? { to: props.premoveTo, code: props.premoveCode }
            : null
        }
      >
        {(premove) => (
          <g
            class={styles['premoveGhost']}
            transform={pieceTransform(premove().to, props.orientation)}
          >
            <PieceImage code={premove().code} opacity={0.4} />
          </g>
        )}
      </Show>
      <For each={props.rows()}>
        {(row) => {
          const dragging = () => props.dragFrom() === row.square;
          const at = () => props.dragAt();
          const transform = () => {
            const atPos = at();
            if (dragging() && atPos !== null) {
              return `translate(${atPos.x - CELL_UNITS / 2} ${atPos.y - CELL_UNITS / 2})`;
            }
            return pieceTransform(row.square, props.orientation);
          };
          const className = () => {
            const parts: string[] = [];
            if (dragging() && at() !== null) {
              parts.push(styles['pieceDragging'] ?? '');
            } else if (
              props.animated() &&
              props.snapSquare() !== row.square &&
              !dragging()
            ) {
              parts.push(styles['pieceAnimated'] ?? '');
            }
            return parts.filter((p) => p.length > 0).join(' ');
          };
          return (
            <>
              <Show when={dragging() && at() !== null}>
                <g
                  class={styles['dragOriginGhost']}
                  transform={pieceTransform(row.square, props.orientation)}
                >
                  <PieceImage code={row.code} opacity={0.35} />
                </g>
              </Show>
              <g transform={transform()} class={className()}>
                <PieceImage code={row.code} />
              </g>
            </>
          );
        }}
      </For>
    </svg>
  );
}
