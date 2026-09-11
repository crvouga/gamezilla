/** @jsxImportSource solid-js */
/**
 * Paint stack for {@link ChessBoard}: squares → pieces → arrows → feedback.
 */

import type { CaptureGhost } from '@pkgs/chess-board-core/capture-ghost';
import type { ChessPieceRow } from '@pkgs/chess-board-core/piece-rows';
import type {
  BoardArrow,
  BoardOrientation,
  BoardTheme,
  CellFeedback,
  CellHighlight,
  Move,
  PieceCode,
  Position,
  Square,
} from '@pkgs/chess-board-core/types';
import type { Accessor, JSX } from 'solid-js';

import { ChessBoardArrows } from './chess-board-arrows';
import { ChessBoardFeedback } from './chess-board-feedback';
import { ChessBoardPieces } from './chess-board-pieces';
import { ChessBoardSquares } from './chess-board-squares';

export type ChessBoardLayersProps = {
  readonly orientation: BoardOrientation;
  readonly theme: BoardTheme;
  readonly position: Position;
  readonly lastMove: Move | null;
  readonly selected: Square | null;
  readonly legalTargets: readonly Square[];
  readonly checkSquare: Square | null;
  readonly cellHighlights: Partial<Record<Square, CellHighlight>> | undefined;
  readonly cellFeedback: Partial<Record<Square, CellFeedback>> | undefined;
  readonly showCoordinates: boolean;
  readonly highlightLastMove: boolean;
  readonly highlightLegalMoves: boolean;
  readonly rows: Accessor<readonly ChessPieceRow[]>;
  readonly captureGhost: Accessor<CaptureGhost | null>;
  readonly snapSquare: Accessor<Square | null>;
  readonly dragFrom: Accessor<Square | null>;
  readonly dragAt: Accessor<{ x: number; y: number } | null>;
  readonly animated: Accessor<boolean>;
  readonly arrows: readonly BoardArrow[];
  readonly premoveFrom: Square | null;
  readonly premoveTo: Square | null;
  readonly premoveCode: PieceCode | null;
};

export function ChessBoardLayers(props: ChessBoardLayersProps): JSX.Element {
  return (
    <>
      <ChessBoardSquares
        orientation={props.orientation}
        theme={props.theme}
        position={props.position}
        lastMove={props.lastMove}
        selected={props.selected}
        legalTargets={props.legalTargets}
        cellHighlights={props.cellHighlights}
        showCoordinates={props.showCoordinates}
        highlightLastMove={props.highlightLastMove}
        highlightLegalMoves={props.highlightLegalMoves}
        checkSquare={props.checkSquare}
        premoveFrom={props.premoveFrom}
        premoveTo={props.premoveTo}
      />
      <ChessBoardPieces
        orientation={props.orientation}
        rows={props.rows}
        captureGhost={props.captureGhost}
        snapSquare={props.snapSquare}
        dragFrom={props.dragFrom}
        dragAt={props.dragAt}
        animated={props.animated}
        premoveTo={props.premoveTo}
        premoveCode={props.premoveCode}
      />
      <ChessBoardArrows
        orientation={props.orientation}
        theme={props.theme}
        arrows={props.arrows}
      />
      <ChessBoardFeedback
        orientation={props.orientation}
        theme={props.theme}
        cellFeedback={props.cellFeedback}
      />
    </>
  );
}
