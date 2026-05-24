import { useMemo, type ReactNode } from 'react';
import { indexFromSquare, squareFromIndex } from './chess-board-geometry';
import { useBoardGestures } from './chess-board-gestures';
import { PIECE_DRAW_SCALE } from './chess-board-piece';
import { useChessBoardSounds } from './chess-board-sounds';
import type {
  BoardArrow,
  BoardTheme,
  ChessBoardProps,
  Move,
  PieceCode,
  Square,
} from './chess-board-types';
import { ChessBoardView } from './chess-board-view';
import { usePieceSkiaImages } from './chess-pieces-cache';
import { pieceCode } from './chess-pieces-svg';
import { useChessBoardApplyMoveSound } from './use-chess-board-apply-move-sound';
import { useChessBoardDragOverlay } from './use-chess-board-drag-overlay';
import {
  useChessBoardDragPortal,
  useComposedContainerRef,
} from './use-chess-board-drag-portal';
import { useExternalFenSync } from './use-chess-board-external-fen-sync';
import { useChessBoardHandlers } from './use-chess-board-handlers';
import {
  useChessBoardDragSharedValues,
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
    | 'dragOverlayPortal'
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

function useDraggedPieceCode(
  dragFrom: Square | null,
  position: ReturnType<typeof useChessGame>['position']
): PieceCode | null {
  return useMemo(() => {
    if (dragFrom === null) return null;
    const p = position[indexFromSquare(dragFrom)] ?? null;
    if (!p) return null;
    return pieceCode(p.color, p.type);
  }, [dragFrom, position]);
}

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
  return useMemo<readonly BoardArrow[]>(() => {
    const ext = externalArrows ?? [];
    if (userArrows.length === 0) return ext;
    return [...ext, ...userArrows];
  }, [externalArrows, userArrows]);
}

type GameStateBundle = {
  game: ReturnType<typeof useChessGame>;
  interaction: ChessBoardInteractionState;
  drag: ReturnType<typeof useChessBoardDragSharedValues>;
  pieceImages: ReturnType<typeof usePieceSkiaImages>;
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
  const drag = useChessBoardDragSharedValues();
  const pieceImages = usePieceSkiaImages();
  const sounds = useChessBoardSounds();
  const applySuccessfulMove = useChessBoardApplyMoveSound(sounds);
  const legalTargets = useMemo(() => {
    if (!highlightLegalMoves || interaction.selected === null) {
      return EMPTY_TARGETS;
    }
    return game.legalMovesFrom(interaction.selected);
  }, [game, highlightLegalMoves, interaction.selected]);
  useExternalFenSync(fen, props.fenSyncKey, game.reset, interaction.clearAll);
  return {
    game,
    interaction,
    drag,
    pieceImages,
    legalTargets,
    rulesFen,
    sounds,
    applySuccessfulMove,
  };
}

type WiringBundle = GameStateBundle & {
  gesture: ReturnType<typeof useBoardGestures>;
  handlers: ReturnType<typeof useChessBoardHandlers>;
  draggedPieceCode: PieceCode | null;
  checkKingSquare: Square | null;
  dragOverlay: ReturnType<typeof useChessBoardDragOverlay>;
  userArrows: ReturnType<typeof useUserArrows>;
  mergedArrows: readonly BoardArrow[];
  composedContainerRef: ReturnType<typeof useComposedContainerRef>;
};

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

type GestureWiringArgs = {
  props: ChessBoardCanvasProps;
  bundle: GameStateBundle;
  handlers: ReturnType<typeof useChessBoardHandlers>;
};

function useGestureWiring(
  args: GestureWiringArgs
): ReturnType<typeof useBoardGestures> {
  const { props, bundle, handlers } = args;
  const { game, interaction, drag, legalTargets } = bundle;
  return useBoardGestures({
    size: props.size,
    orientation: props.orientation,
    interactive: props.interactive,
    position: game.position,
    turn: game.turn,
    selected: interaction.selected,
    legalTargets,
    dragX: drag.dragX,
    dragY: drag.dragY,
    isDragging: drag.isDragging,
    dragPickupScale: drag.dragPickupScale,
    dragPickupOpacity: drag.dragPickupOpacity,
    setSelected: handlers.setSelected,
    onDragStart: handlers.onDragStart,
    onDragEnd: handlers.onDragEnd,
    onHoverSquare: handlers.onHoverSquare,
    onDrop: handlers.onDrop,
  });
}

function useWiringBundle(
  props: ChessBoardCanvasProps,
  bundle: GameStateBundle
): WiringBundle {
  const handlers = useChessBoardHandlers({
    interaction: bundle.interaction,
    game: bundle.game,
    rulesFen: bundle.rulesFen,
    sounds: bundle.sounds,
    applySuccessfulMove: bundle.applySuccessfulMove,
    onMove: props.onMove,
  });
  const gesture = useGestureWiring({ props, bundle, handlers });
  const checkKingSquare = useCheckKingSquare(
    bundle.game.inCheck,
    bundle.game.position,
    bundle.game.turn
  );
  const draggedPieceCode = useDraggedPieceCode(
    bundle.interaction.dragFrom,
    bundle.game.position
  );
  const dragOverlay = useChessBoardDragOverlay(props.dragOverlayPortal);
  const userArrows = useUserArrowsForBoard(props);
  const composedContainerRef = useComposedContainerRef(
    dragOverlay.containerRef,
    userArrows.containerRef
  );
  const pieceDraw = (props.size / 8) * PIECE_DRAW_SCALE;
  useChessBoardDragPortal({
    dragOverlay,
    enabled: props.dragOverlayPortal,
    pieceImages: bundle.pieceImages,
    draggedPieceCode,
    dragX: bundle.drag.dragX,
    dragY: bundle.drag.dragY,
    isDragging: bundle.drag.isDragging,
    dragPickupOpacity: bundle.drag.dragPickupOpacity,
    dragPickupScale: bundle.drag.dragPickupScale,
    pieceDraw,
  });
  const mergedArrows = useMergedArrows(props.arrows, userArrows.arrows);
  return {
    ...bundle,
    handlers,
    gesture,
    checkKingSquare,
    draggedPieceCode,
    dragOverlay,
    userArrows,
    mergedArrows,
    composedContainerRef,
  };
}

export function ChessBoardCanvas(props: ChessBoardCanvasProps): ReactNode {
  const bundle = useGameStateBundle(props);
  const wiring = useWiringBundle(props, bundle);
  const pieceDraw = (props.size / 8) * PIECE_DRAW_SCALE;
  return (
    <ChessBoardView
      size={props.size}
      theme={props.theme}
      orientation={props.orientation}
      dragOverlayPortal={props.dragOverlayPortal}
      pendingPromotion={bundle.interaction.pendingPromotion}
      pieceImages={bundle.pieceImages}
      pieceDraw={pieceDraw}
      draggedPieceCode={wiring.draggedPieceCode}
      drag={bundle.drag}
      gesture={wiring.gesture}
      dragOverlay={wiring.dragOverlay}
      composedContainerRef={wiring.composedContainerRef}
      userArrowsWebHandlers={wiring.userArrows.webEventHandlers}
      onPromotionCancel={wiring.handlers.onPromotionCancel}
      onPromotionPick={wiring.handlers.onPromotionPick}
      contentProps={{
        size: props.size,
        orientation: props.orientation,
        theme: props.theme,
        showCoordinates: props.showCoordinates,
        highlightLastMove: props.highlightLastMove,
        cellHighlights: props.cellHighlights,
        cellFeedback: props.cellFeedback,
        pieceImages: bundle.pieceImages,
        pieceDraw,
        interaction: bundle.interaction,
        game: bundle.game,
        legalTargets: bundle.legalTargets,
        checkKingSquare: wiring.checkKingSquare,
        mergedArrows: wiring.mergedArrows,
      }}
    />
  );
}
