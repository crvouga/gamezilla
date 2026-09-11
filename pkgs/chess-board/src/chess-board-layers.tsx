/** @jsxImportSource solid-js */
/**
 * Paint stack: background → squares → pieces → shapes → feedback.
 */

import type { CaptureGhost } from '@pkgs/chess-board-core/capture-ghost';
import type { ChessPieceRow } from '@pkgs/chess-board-core/piece-rows';
import type { BoardShape } from '@pkgs/chess-board-core/shapes/board-shapes';
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

import { ChessBoardBackground } from './chess-board-background';
import { ChessBoardFeedback } from './chess-board-feedback';
import { ChessBoardPieces } from './chess-board-pieces';
import { ChessBoardShapes } from './chess-board-shapes';
import { ChessBoardSquares } from './chess-board-squares';
import type { DragGhostController } from './drag-ghost-controller';

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
  readonly dragGhost: DragGhostController;
  readonly animated: Accessor<boolean>;
  readonly arrows: readonly BoardArrow[];
  readonly shapes: readonly BoardShape[];
  readonly premoveFrom: Square | null;
  readonly premoveTo: Square | null;
  readonly premoveCode: PieceCode | null;
};

export function ChessBoardLayers(props: ChessBoardLayersProps): JSX.Element {
  return (
    <>
      <ChessBoardBackground />
      <ChessBoardSquares
        orientation={props.orientation}
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
        dragGhost={props.dragGhost}
        animated={props.animated}
        premoveTo={props.premoveTo}
        premoveCode={props.premoveCode}
      />
      <ChessBoardShapes
        orientation={props.orientation}
        theme={props.theme}
        shapes={props.shapes}
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
