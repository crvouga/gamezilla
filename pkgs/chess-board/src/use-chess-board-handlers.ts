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
  setDragFrom: (sq: Square | null) => void;
  /** Apply drop; true when ply applied or promotion opened. */
  tryApplyDrop: (from: Square, to: Square) => boolean;
  onPromotionPick: (p: NonNullable<Move['promotion']>) => void;
  onPromotionCancel: () => void;
};

function useSelectionHandlers(
  interaction: ChessBoardInteractionState
): Pick<ChessBoardHandlers, 'setSelected' | 'setDragFrom'> {
  const setSelected = useStableHandler((sq: Square | null) => {
    interaction.setSelected(sq);
  });
  const setDragFrom = useStableHandler((sq: Square | null) => {
    interaction.setDragFrom(sq);
  });
  return { setSelected, setDragFrom };
}

function useDropApply(args: ChessBoardHandlersArgs): {
  tryApplyDrop: (from: Square, to: Square) => boolean;
} {
  const { interaction, game, rulesFen, sounds, applySuccessfulMove, onMove } =
    args;
  const tryApplyDrop = useStableHandler((fromSq: Square, toSq: Square) => {
    return handleDropAttempt({
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
  return { tryApplyDrop };
}

function usePromotionHandlers(args: ChessBoardHandlersArgs): Pick<
  ChessBoardHandlers,
  'onPromotionPick' | 'onPromotionCancel'
> {
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

/** Stable callbacks for board DnD / promotion handlers. */
export function useChessBoardHandlers(
  args: ChessBoardHandlersArgs
): ChessBoardHandlers {
  const selection = useSelectionHandlers(args.interaction);
  const drop = useDropApply(args);
  const promotion = usePromotionHandlers(args);
  return { ...selection, ...drop, ...promotion };
}
