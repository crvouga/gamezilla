/** @jsxImportSource solid-js */
/**
 * Piece layer: one HTML box per piece, placed by `transform` through the
 * {@link PieceAnimator}. Rows keep their identity across plies
 * (`createPieceRowsTracker`), so `<For>` keeps each piece's node and a move
 * only re-places the pieces whose square changed — everything else is
 * untouched. Ghosts (capture, premove) are static boxes; a dragged piece
 * stays here faded while its avatar follows the pointer (`piece-drag.ts`).
 */

import type { CaptureGhost } from '@pkgs/chess-board-core-shared-ts/capture-ghost';
import type { ChessPieceRow } from '@pkgs/chess-board-core-shared-ts/piece-rows';
import { chessBoardLayerTestId } from '@pkgs/chess-board-core-shared-ts/probe';
import type {
  BoardOrientation,
  PieceCode,
  Square,
} from '@pkgs/chess-board-core-shared-ts/types';
import type { MotionPolicy } from '@pkgs/chess-board-root-shared-ts/board-motion';
import { cellTransform } from '@pkgs/chess-board-root-shared-ts/board-units';
import type { PieceAnimator } from '@pkgs/chess-board-root-shared-ts/piece-animator';
import { bumpChessBoardRender } from '@pkgs/chess-board-root-shared-ts/render-counts';
import {
  type Accessor,
  createEffect,
  createMemo,
  For,
  type JSX,
  on,
  onCleanup,
  Show,
  untrack,
} from 'solid-js';
import styles from '../chess-board/chess-board.module.css';
import { HtmlPaintToken } from '../paint-token/index';

export type PremoveGhost = {
  readonly to: Square;
  readonly code: PieceCode;
};

export type ChessBoardPiecesProps = {
  readonly boardTestId: string;
  readonly orientation: Accessor<BoardOrientation>;
  readonly rows: Accessor<readonly ChessPieceRow[]>;
  readonly captureGhost: Accessor<CaptureGhost | null>;
  readonly premoveGhosts: Accessor<readonly PremoveGhost[]>;
  readonly animator: PieceAnimator;
  readonly motion: Accessor<MotionPolicy>;
  /** The position now shown replaced the last one instead of following a move. */
  readonly replacement: () => boolean;
  /** A piece is chosen or held: a gesture is under way. */
  readonly engaged: () => boolean;
};

const PIECE_CLASS = `${styles['cell']} ${styles['piece']}`;

function Piece(props: {
  readonly row: ChessPieceRow;
  readonly rows: Accessor<readonly ChessPieceRow[]>;
  readonly orientation: Accessor<BoardOrientation>;
  readonly animator: PieceAnimator;
  readonly motion: Accessor<MotionPolicy>;
  readonly replacement: () => boolean;
}): JSX.Element {
  let el: HTMLDivElement | undefined;
  // The tracker reuses (mutates) a surviving row so `<For>` keeps its node;
  // `rows()` is the signal that a row moved / promoted. The memos narrow it
  // to *this* piece, so an unmoved piece does no work on a move.
  const square = createMemo(() => {
    props.rows();
    return props.row.square;
  });
  const code = createMemo(() => {
    props.rows();
    return props.row.code;
  });
  const orientation = () => props.orientation();
  createEffect(
    on([square, orientation], ([sq, o], prev) => {
      const node = el;
      if (node === undefined) return;
      const policy = props.motion();
      // Flipping the board re-seats every piece at once: no slide.
      const slide = prev?.[1] === o && policy.slides;
      props.animator.place(node, cellTransform(sq, o), {
        slide,
        durationMs: policy.durationMs,
        arrival: {
          rows: untrack(props.rows),
          replacement: props.replacement(),
        },
      });
    })
  );
  onCleanup(() => {
    if (el !== undefined) props.animator.remove(el);
  });
  return (
    <div
      ref={el}
      class={PIECE_CLASS}
      data-piece={code()}
      data-piece-square={square()}
    >
      <HtmlPaintToken kind="piece" detail={code()} at={square()} />
    </div>
  );
}

function StaticPiece(props: {
  readonly class: string;
  readonly code: PieceCode;
  readonly square: Square;
  readonly orientation: BoardOrientation;
  readonly token: 'capture-ghost' | 'premove-ghost';
}): JSX.Element {
  return (
    <div
      class={`${PIECE_CLASS} ${props.class}`}
      data-piece={props.code}
      style={{ transform: cellTransform(props.square, props.orientation) }}
    >
      <HtmlPaintToken
        kind={props.token}
        detail={props.code}
        at={props.square}
      />
    </div>
  );
}

export function ChessBoardPieces(props: ChessBoardPiecesProps): JSX.Element {
  bumpChessBoardRender('pieces');
  // A position that re-places no piece (one only appears or leaves) is still
  // an arrival: it too must settle the slides it interrupts.
  createEffect(
    on(
      () => props.rows(),
      (rows) =>
        props.animator.arrive({ rows, replacement: props.replacement() })
    )
  );
  createEffect(() => {
    if (props.engaged()) props.animator.interrupt();
  });
  return (
    <div
      class={styles['contents']}
      aria-hidden="true"
      data-testid={chessBoardLayerTestId(props.boardTestId, 'pieces')}
    >
      <Show when={props.captureGhost()}>
        {(ghost) => (
          <StaticPiece
            class={styles['captureGhost'] ?? ''}
            code={ghost().code}
            square={ghost().square}
            orientation={props.orientation()}
            token="capture-ghost"
          />
        )}
      </Show>
      <For each={props.premoveGhosts()}>
        {(ghost) => (
          <StaticPiece
            class={styles['premoveGhost'] ?? ''}
            code={ghost.code}
            square={ghost.to}
            orientation={props.orientation()}
            token="premove-ghost"
          />
        )}
      </For>
      <For each={props.rows()}>
        {(row) => (
          <Piece
            row={row}
            rows={props.rows}
            orientation={props.orientation}
            animator={props.animator}
            motion={props.motion}
            replacement={props.replacement}
          />
        )}
      </For>
    </div>
  );
}
