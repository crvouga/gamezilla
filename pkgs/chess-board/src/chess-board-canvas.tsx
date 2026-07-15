import { memo, useMemo, type ReactNode } from 'react';
import type { ChessBoardCanvasContentProps } from './chess-board-canvas-content';
import type { ChessBoardInteractionLayerProps } from './chess-board-interaction-layer';
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
import { useExternalFenSync } from './use-chess-board-external-fen-sync';
import { useChessBoardHandlers } from './use-chess-board-handlers';
import { useChessBoardInteraction } from './use-chess-board-interaction';
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
  ix: ReturnType<typeof useChessBoardInteraction>;
};

function useContentProps(args: ContentPropsArgs): ChessBoardCanvasContentProps {
  const { props, bundle, checkKingSquare, mergedArrows, pieceDraw, ix } = args;
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
      pieceRows: bundle.pieceRows,
      dragFrom: bundle.interaction.dragFrom,
      drag: ix.drag,
      snapKeys: ix.snapKeys,
      onSnapConsumed: ix.onSnapConsumed,
      selected: bundle.interaction.selected,
      hoverSquareIndex: ix.hoverSquareIndex,
      legalMarkersOpacity: ix.legalMarkersOpacity,
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
      bundle.pieceRows,
      bundle.interaction.dragFrom,
      ix.drag,
      ix.snapKeys,
      ix.onSnapConsumed,
      bundle.interaction.selected,
      ix.hoverSquareIndex,
      ix.legalMarkersOpacity,
      bundle.game,
      bundle.legalTargets,
      checkKingSquare,
      mergedArrows,
    ]
  );
}

function useInteractionLayerProps(
  props: ChessBoardCanvasProps,
  bundle: GameStateBundle,
  handlers: ReturnType<typeof useChessBoardHandlers>
): {
  interactionProps: ChessBoardInteractionLayerProps;
  ix: ReturnType<typeof useChessBoardInteraction>;
} {
  const ix = useChessBoardInteraction({
    interactive: props.interactive,
    turn: bundle.game.turn,
    position: bundle.game.position,
    pieceRows: bundle.pieceRows,
    selected: bundle.interaction.selected,
    setSelected: handlers.setSelected,
    setDragFrom: handlers.setDragFrom,
    tryApplyDrop: handlers.tryApplyDrop,
    applyDropRules: handlers.applyDropRules,
    commitDropUi: handlers.commitDropUi,
    size: props.size,
    orientation: props.orientation,
  });
  return {
    ix,
    interactionProps: {
      size: props.size,
      orientation: props.orientation,
      hoverSquareIndex: ix.hoverSquareIndex,
      legalMarkersOpacity: ix.legalMarkersOpacity,
      drag: ix.drag,
      dragKeyTable: ix.dragKeyTable,
      onDragStart: ix.onDragStart,
      onPanEnd: ix.onPanEnd,
      onSquareTap: ix.onSquareTap,
      onDragCancel: ix.onDragCancel,
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
  const { interactionProps, ix } = useInteractionLayerProps(
    props,
    bundle,
    handlers
  );
  const contentProps = useContentProps({
    props,
    bundle,
    checkKingSquare,
    mergedArrows,
    pieceDraw,
    ix,
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
      interactionProps={interactionProps}
    />
  );
}

export const ChessBoardCanvas = memo(ChessBoardCanvasImpl);
