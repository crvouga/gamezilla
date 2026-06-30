import {
  handleDropAttempt,
  handlePromotionPick,
} from './chess-board-drop-handler';
import { hapticSelection } from './chess-board-haptics';
import type { ChessBoardSounds } from './chess-board-sounds';
import type { Move, Square } from './chess-board-types';
import type { useChessBoardApplyMoveSound } from './use-chess-board-apply-move-sound';
import type { ChessBoardInteractionState } from './use-chess-board-interaction-state';
import type { useChessGame } from './use-chess-game';
import { useStableHandler } from './use-stable-handler';

export type ChessBoardHandlersArgs = {
  interaction: ChessBoardInteractionState;
  game: ReturnType<typeof useChessGame>;
  rulesFen: string | undefined;
  sounds: ChessBoardSounds;
  applySuccessfulMove: ReturnType<typeof useChessBoardApplyMoveSound>;
  onMove: ((m: Move) => void) | undefined;
};

export type ChessBoardHandlers = {
  setSelected: (sq: Square | null) => void;
  /** Batched pickup: sets dragFrom + selected before isDragging flips on UI thread. */
  onPanPickupStart: (from: Square) => void;
  onDragStart: (from: Square) => void;
  onDragEnd: () => void;
  onHoverSquare: (sq: Square | null) => void;
  onDrop: (from: Square, to: Square) => void;
  /**
   * Atomic finger-up handler. The gesture worklet packs the start /
   * destination squares into a single object and hops to JS once;
   * `commitDrop` applies the drop FIRST (so the move lands and the piece
   * lives at the destination after the next render) and then clears the
   * transient interaction state in the same JS task. React 18 batches
   * the resulting setState calls into a single commit, which means the
   * piece never appears on its source square between "finger-up" and
   * "drop applied" — the visible "snap-back, then slide" flash on mobile
   * web is gone.
   */
  commitDrop: (p: { startSq: Square | null; toSq: Square | null }) => void;
  onPromotionPick: (p: NonNullable<Move['promotion']>) => void;
  onPromotionCancel: () => void;
};

type InteractionHandlers = Pick<
  ChessBoardHandlers,
  | 'setSelected'
  | 'onPanPickupStart'
  | 'onDragStart'
  | 'onDragEnd'
  | 'onHoverSquare'
>;

function useInteractionHandlers(
  interaction: ChessBoardInteractionState
): InteractionHandlers {
  const setSelected = useStableHandler((sq: Square | null) => {
    interaction.setSelected(sq);
  });
  const onPanPickupStart = useStableHandler((from: Square) => {
    interaction.setDragFrom(from);
    interaction.setSelected(from);
  });
  const onDragStart = useStableHandler((from: Square) => {
    interaction.setDragFrom(from);
  });
  const onDragEnd = useStableHandler(() => {
    interaction.setDragFrom(null);
    interaction.setHoveredSquare(null);
  });
  const onHoverSquare = useStableHandler((sq: Square | null) => {
    interaction.setHoveredSquare(sq);
  });
  return {
    setSelected,
    onPanPickupStart,
    onDragStart,
    onDragEnd,
    onHoverSquare,
  };
}

type DropHandlers = Pick<ChessBoardHandlers, 'onDrop' | 'commitDrop'>;

function useDropHandlers(args: ChessBoardHandlersArgs): DropHandlers {
  const { interaction, game, rulesFen, sounds, applySuccessfulMove, onMove } =
    args;
  const dispatchDrop = useStableHandler((fromSq: Square, toSq: Square) => {
    handleDropAttempt({
      fromSq,
      toSq,
      rulesFen,
      position: game.position,
      turn: game.turn,
      game,
      sounds,
      applySuccessfulMove,
      onMove,
      setPendingPromotion: interaction.setPendingPromotion,
    });
  });
  const commitDrop = useStableHandler(
    (p: { startSq: Square | null; toSq: Square | null }) => {
      const { startSq, toSq } = p;
      // Apply the move FIRST. `tryMove` mutates `lastMove` + `fen` via
      // setState, and React 18 batches both with the cleanup setStates
      // below into a single commit — so by the time the next render
      // runs, the piece already lives at `toSq` and clearing `dragFrom`
      // never reveals the original source square.
      if (startSq !== null && toSq !== null && startSq !== toSq) {
        dispatchDrop(startSq, toSq);
      }
      // React's `Object.is` bail-out short-circuits set-to-same setState
      // calls already; explicit guards would only save the scheduler hop.
      interaction.setDragFrom(null);
      interaction.setHoveredSquare(null);
      interaction.setSelected(null);
    }
  );
  return { onDrop: dispatchDrop, commitDrop };
}

type PromotionHandlers = Pick<
  ChessBoardHandlers,
  'onPromotionPick' | 'onPromotionCancel'
>;

function usePromotionHandlers(args: ChessBoardHandlersArgs): PromotionHandlers {
  const { interaction, game, rulesFen, sounds, applySuccessfulMove, onMove } =
    args;
  const onPromotionPick = useStableHandler(
    (p: NonNullable<Move['promotion']>) => {
      const pending = interaction.pendingPromotion;
      if (pending === null) return;
      handlePromotionPick({
        pending,
        promotion: p,
        rulesFen,
        game,
        sounds,
        applySuccessfulMove,
        onMove,
        setPendingPromotion: interaction.setPendingPromotion,
      });
    }
  );
  const onPromotionCancel = useStableHandler(() => {
    interaction.setPendingPromotion(null);
    hapticSelection();
  });
  return { onPromotionPick, onPromotionCancel };
}

/**
 * Stable callbacks for every gesture / promotion handler the canvas needs.
 * Each returned function keeps a fixed identity across renders so consumers
 * (gesture recognizer, promotion overlay) don't recreate their memos every
 * time the parent re-renders (e.g. on a hover state change).
 */
export function useChessBoardHandlers(
  args: ChessBoardHandlersArgs
): ChessBoardHandlers {
  const interaction = useInteractionHandlers(args.interaction);
  const drop = useDropHandlers(args);
  const promotion = usePromotionHandlers(args);
  return { ...interaction, ...drop, ...promotion };
}
