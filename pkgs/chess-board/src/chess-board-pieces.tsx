/** @jsxImportSource solid-js */
/**
 * Piece layer: stable-id rows slide via CSS `transform`; the capture ghost
 * fades at the vacated square; the dragged piece is an imperative ghost
 * (rAF transform) while the source square stays faintly visible.
 */

import type { CaptureGhost } from '@pkgs/chess-board-core/capture-ghost';
import type { ChessPieceRow } from '@pkgs/chess-board-core/piece-rows';
import { chessBoardLayerTestId } from '@pkgs/chess-board-core/probe';
import type {
  BoardOrientation,
  PieceCode,
  Square,
} from '@pkgs/chess-board-core/types';
import { type Accessor, createMemo, For, type JSX, Show } from 'solid-js';

import { BOARD_UNITS, CELL_UNITS, squareOrigin } from './board-units';
import styles from './chess-board.module.css';
import { bumpChessBoardRender } from './dev/render-counts';
import type { DragGhostController } from './drag-ghost-controller';
import { PaintToken } from './paint-token';
import { PIECE_IMAGE_URIS } from './piece-images';

export type ChessBoardPiecesProps = {
  readonly boardTestId: string;
  readonly orientation: BoardOrientation;
  readonly rows: Accessor<readonly ChessPieceRow[]>;
  readonly captureGhost: Accessor<CaptureGhost | null>;
  readonly snapSquare: Accessor<Square | null>;
  readonly dragFrom: Accessor<Square | null>;
  readonly dragGhost: DragGhostController;
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

function DragGhostLayer(props: {
  readonly dragFrom: Accessor<Square | null>;
  readonly rows: Accessor<readonly ChessPieceRow[]>;
  readonly dragGhost: DragGhostController;
}): JSX.Element {
  const dragCode = createMemo((): PieceCode | null => {
    const from = props.dragFrom();
    if (from === null) return null;
    const row = props.rows().find((r) => r.square === from);
    return row?.code ?? null;
  });
  return (
    <g
      class={styles['dragGhost']}
      ref={(el) => props.dragGhost.setElement(el)}
      style={{ visibility: 'hidden' }}
    >
      <Show when={dragCode()}>{(code) => <PieceImage code={code()} />}</Show>
    </g>
  );
}

function PieceRow(props: {
  readonly row: ChessPieceRow;
  readonly rows: Accessor<readonly ChessPieceRow[]>;
  readonly orientation: BoardOrientation;
  readonly dragFrom: Accessor<Square | null>;
  readonly snapSquare: Accessor<Square | null>;
  readonly animated: Accessor<boolean>;
}): JSX.Element {
  // The tracker reuses (mutates) a surviving row so `<For>` keeps its node
  // and the piece slides; `rows()` is the signal that a row moved / promoted.
  const square = (): Square => {
    props.rows();
    return props.row.square;
  };
  const code = (): PieceCode => {
    props.rows();
    return props.row.code;
  };
  const dragging = () => props.dragFrom() === square();
  const className = () => {
    if (dragging() || !props.animated() || props.snapSquare() === square()) {
      return '';
    }
    return styles['pieceAnimated'] ?? '';
  };
  return (
    <>
      <Show when={dragging()}>
        <g
          class={styles['dragOriginGhost']}
          transform={pieceTransform(square(), props.orientation)}
        >
          <PieceImage code={code()} opacity={0.35} />
          <PaintToken kind="drag-origin" detail={code()} at={square()} />
        </g>
      </Show>
      <g
        transform={pieceTransform(square(), props.orientation)}
        class={className()}
        style={{ visibility: dragging() ? 'hidden' : undefined }}
      >
        <PieceImage code={code()} />
        <PaintToken kind="piece" detail={code()} at={square()} />
      </g>
    </>
  );
}

export function ChessBoardPieces(props: ChessBoardPiecesProps): JSX.Element {
  bumpChessBoardRender('pieces');
  return (
    <svg
      class={`${styles['layer']} ${styles['svgLayer']}`}
      viewBox={`0 0 ${BOARD_UNITS} ${BOARD_UNITS}`}
      aria-hidden="true"
      data-testid={chessBoardLayerTestId(props.boardTestId, 'pieces')}
    >
      <Show when={props.captureGhost()}>
        {(ghost) => (
          <g
            class={styles['captureGhost']}
            transform={pieceTransform(ghost().square, props.orientation)}
          >
            <PieceImage code={ghost().code} />
            <PaintToken
              kind="capture-ghost"
              detail={ghost().code}
              at={ghost().square}
            />
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
            <PaintToken
              kind="premove-ghost"
              detail={premove().code}
              at={premove().to}
            />
          </g>
        )}
      </Show>
      <For each={props.rows()}>
        {(row) => (
          <PieceRow
            row={row}
            rows={props.rows}
            orientation={props.orientation}
            dragFrom={props.dragFrom}
            snapSquare={props.snapSquare}
            animated={props.animated}
          />
        )}
      </For>
      <DragGhostLayer
        dragFrom={props.dragFrom}
        rows={props.rows}
        dragGhost={props.dragGhost}
      />
    </svg>
  );
}
