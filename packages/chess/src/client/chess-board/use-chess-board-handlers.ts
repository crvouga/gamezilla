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
  onDragStart: (from: Square) => void;
  onDragEnd: () => void;
  onHoverSquare: (sq: Square | null) => void;
  onDrop: (from: Square, to: Square) => void;
  onPromotionPick: (p: NonNullable<Move['promotion']>) => void;
  onPromotionCancel: () => void;
};

/**
 * Stable callbacks for every gesture / promotion handler the canvas needs.
 * Each returned function keeps a fixed identity across renders so consumers
 * (gesture recognizer, promotion overlay) don't recreate their memos every
 * time the parent re-renders (e.g. on a hover state change).
 */
export function useChessBoardHandlers(
  args: ChessBoardHandlersArgs
): ChessBoardHandlers {
  const { interaction, game, rulesFen, sounds, applySuccessfulMove, onMove } =
    args;
  const setSelected = useStableHandler((sq: Square | null) => {
    interaction.setSelected(sq);
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
  const onDrop = useStableHandler((fromSq: Square, toSq: Square) => {
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
  return {
    setSelected,
    onDragStart,
    onDragEnd,
    onHoverSquare,
    onDrop,
    onPromotionPick,
    onPromotionCancel,
  };
}
