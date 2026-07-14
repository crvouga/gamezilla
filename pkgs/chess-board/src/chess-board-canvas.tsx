import { memo, useMemo, type ReactNode } from 'react';
import type { ChessBoardCanvasContentProps } from './chess-board-canvas-content';
import type { ChessBoardDndLayerProps } from './chess-board-dnd-layer';
import { squareFromIndex } from './chess-board-geometry';
import { PIECE_DRAW_SCALE } from './chess-board-piece';
import {
  useChessPieceRows,
  type ChessPieceRow,
} from './chess-board-piece-identities';
import { useChessBoardSounds } from './chess-board-sounds';
import type {
  BoardArrow,
  BoardTheme,
  ChessBoardProps,
  Move,
  Square,
} from './chess-board-types';
import { ChessBoardView } from './chess-board-view';
import { usePieceCaches, type PieceImageCache } from './chess-pieces-cache';
import { useChessBoardApplyMoveSound } from './use-chess-board-apply-move-sound';
import { useChessBoardDnd } from './use-chess-board-dnd';
import { useExternalFenSync } from './use-chess-board-external-fen-sync';
import { useChessBoardHandlers } from './use-chess-board-handlers';
import {
  useChessBoardInteractionState,
  type ChessBoardInteractionState,
} from './use-chess-board-interaction-state';
import { useUserArrows } from './use-chess-board-user-arrows';
import { useChessGame } from './use-chess-game';

const EMPTY_TARGETS: readonly Square[] = Object.freeze([]);

export type ChessBoardCanvasProps = Required<
  Pick<
    ChessBoardProps,
    | 'orientation'
    | 'interactive'
    | 'showCoordinates'
    | 'highlightLastMove'
    | 'highlightLegalMoves'
    | 'enableUserArrows'
  >
> & {
  fen?: string;
  onMove?: (m: Move) => void;
  controlled?: boolean;
  fenSyncKey?: number;
  size: number;
  theme: BoardTheme;
  cellFeedback?: ChessBoardProps['cellFeedback'];
  cellHighlights?: ChessBoardProps['cellHighlights'];
  arrows?: readonly BoardArrow[];
  onUserArrowsChange?: ChessBoardProps['onUserArrowsChange'];
};

function useCheckKingSquare(
  inCheck: boolean,
  position: ReturnType<typeof useChessGame>['position'],
  turn: 'w' | 'b'
): Square | null {
  return useMemo(() => {
    if (!inCheck) return null;
    for (let i = 0; i < 64; i++) {
      const p = position[i];
      if (p && p.type === 'k' && p.color === turn) return squareFromIndex(i);
    }
    return null;
  }, [inCheck, position, turn]);
}

function useMergedArrows(
  externalArrows: readonly BoardArrow[] | undefined,
  userArrows: readonly BoardArrow[]
): readonly BoardArrow[] {
  return useMemo(() => {
    const ext = externalArrows ?? [];
    if (userArrows.length === 0) return ext;
    return [...ext, ...userArrows];
  }, [externalArrows, userArrows]);
}

type GameStateBundle = {
  game: ReturnType<typeof useChessGame>;
  interaction: ChessBoardInteractionState;
  pieceImages: PieceImageCache | null;
  pieceRows: readonly ChessPieceRow[];
  legalTargets: readonly Square[];
  rulesFen: string | undefined;
  sounds: ReturnType<typeof useChessBoardSounds>;
  applySuccessfulMove: ReturnType<typeof useChessBoardApplyMoveSound>;
};

function useGameStateBundle(props: ChessBoardCanvasProps): GameStateBundle {
  const { fen, controlled = false, highlightLegalMoves } = props;
  const rulesFen =
    controlled && fen !== undefined && fen.length > 0 ? fen : undefined;
  const game = useChessGame({ ...(fen ? { initialFen: fen } : {}) });
  const interaction = useChessBoardInteractionState();
  const pieceCaches = usePieceCaches();
  const pieceImages = pieceCaches?.images ?? null;
  const sounds = useChessBoardSounds();
  const applySuccessfulMove = useChessBoardApplyMoveSound(sounds);
  const { active: pieceRows } = useChessPieceRows(
    game.position,
    game.lastMove
  );
  const legalTargets = useMemo(() => {
    if (!highlightLegalMoves || interaction.dragFrom === null) {
      return EMPTY_TARGETS;
    }
    return game.legalMovesFrom(interaction.dragFrom);
  }, [game, highlightLegalMoves, interaction.dragFrom]);
  useExternalFenSync(fen, props.fenSyncKey, game.reset, interaction.clearAll);
  return {
    game,
    interaction,
    pieceImages,
    pieceRows,
    legalTargets,
    rulesFen,
    sounds,
    applySuccessfulMove,
  };
}

function useUserArrowsForBoard(
  props: ChessBoardCanvasProps
): ReturnType<typeof useUserArrows> {
  const { size, orientation, theme, enableUserArrows, onUserArrowsChange } =
    props;
  return useUserArrows({
    size,
    orientation,
    theme,
    enabled: enableUserArrows,
    ...(onUserArrowsChange !== undefined
      ? { onChange: onUserArrowsChange }
      : {}),
  });
}

type ContentPropsArgs = {
  props: ChessBoardCanvasProps;
  bundle: GameStateBundle;
  checkKingSquare: Square | null;
  mergedArrows: readonly BoardArrow[];
  pieceDraw: number;
  hoverSquareIndex: ReturnType<typeof useChessBoardDnd>['hoverSquareIndex'];
};

function useContentProps(args: ContentPropsArgs): ChessBoardCanvasContentProps {
  const {
    props,
    bundle,
    checkKingSquare,
    mergedArrows,
    pieceDraw,
    hoverSquareIndex,
  } = args;
  return useMemo(
    () => ({
      size: props.size,
      orientation: props.orientation,
      theme: props.theme,
      showCoordinates: props.showCoordinates,
      highlightLastMove: props.highlightLastMove,
      cellHighlights: props.cellHighlights,
      cellFeedback: props.cellFeedback,
      pieceImages: bundle.pieceImages,
      pieceDraw,
      selected: bundle.interaction.selected,
      hoverSquareIndex,
      game: bundle.game,
      legalTargets: bundle.legalTargets,
      checkKingSquare,
      mergedArrows,
    }),
    [
      props.size,
      props.orientation,
      props.theme,
      props.showCoordinates,
      props.highlightLastMove,
      props.cellHighlights,
      props.cellFeedback,
      bundle.pieceImages,
      pieceDraw,
      bundle.interaction.selected,
      hoverSquareIndex,
      bundle.game,
      bundle.legalTargets,
      checkKingSquare,
      mergedArrows,
    ]
  );
}

function useDndLayerProps(
  props: ChessBoardCanvasProps,
  bundle: GameStateBundle,
  handlers: ReturnType<typeof useChessBoardHandlers>,
  pieceDraw: number
): {
  dndProps: ChessBoardDndLayerProps;
  hoverSquareIndex: ReturnType<typeof useChessBoardDnd>['hoverSquareIndex'];
} {
  const dnd = useChessBoardDnd({
    interactive: props.interactive,
    turn: bundle.game.turn,
    position: bundle.game.position,
    pieceRows: bundle.pieceRows,
    selected: bundle.interaction.selected,
    setSelected: handlers.setSelected,
    setDragFrom: handlers.setDragFrom,
    tryApplyDrop: handlers.tryApplyDrop,
  });
  return {
    hoverSquareIndex: dnd.hoverSquareIndex,
    dndProps: {
      size: props.size,
      orientation: props.orientation,
      pieceDraw,
      dragData: dnd.dragData,
      remountKeys: dnd.remountKeys,
      canDragFrom: dnd.canDragFrom,
      onDragStart: dnd.onDragStart,
      onDragEnd: dnd.onDragEnd,
      onDropToSquare: dnd.onDropToSquare,
      onSquareTap: dnd.onSquareTap,
      onHoverChange: dnd.onHoverChange,
    },
  };
}

function ChessBoardCanvasImpl(props: ChessBoardCanvasProps): ReactNode {
  const bundle = useGameStateBundle(props);
  const handlers = useChessBoardHandlers({
    interaction: bundle.interaction,
    game: bundle.game,
    rulesFen: bundle.rulesFen,
    sounds: bundle.sounds,
    applySuccessfulMove: bundle.applySuccessfulMove,
    onMove: props.onMove,
  });
  const checkKingSquare = useCheckKingSquare(
    bundle.game.inCheck,
    bundle.game.position,
    bundle.game.turn
  );
  const userArrows = useUserArrowsForBoard(props);
  const mergedArrows = useMergedArrows(props.arrows, userArrows.arrows);
  const pieceDraw = (props.size / 8) * PIECE_DRAW_SCALE;
  const { dndProps, hoverSquareIndex } = useDndLayerProps(
    props,
    bundle,
    handlers,
    pieceDraw
  );
  const contentProps = useContentProps({
    props,
    bundle,
    checkKingSquare,
    mergedArrows,
    pieceDraw,
    hoverSquareIndex,
  });
  return (
    <ChessBoardView
      size={props.size}
      theme={props.theme}
      orientation={props.orientation}
      pendingPromotion={bundle.interaction.pendingPromotion}
      pieceImages={bundle.pieceImages}
      pieceDraw={pieceDraw}
      containerRef={userArrows.containerRef}
      userArrowsWebHandlers={userArrows.webEventHandlers}
      onPromotionCancel={handlers.onPromotionCancel}
      onPromotionPick={handlers.onPromotionPick}
      contentProps={contentProps}
      dndProps={dndProps}
    />
  );
}

export const ChessBoardCanvas = memo(ChessBoardCanvasImpl);
