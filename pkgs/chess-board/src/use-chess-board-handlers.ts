import {
  applyDropRules,
  commitDropUi,
  type DropAttemptArgs,
  type DropOutcome,
  handlePromotionPick,
} from './chess-board-drop-handler';
import { hapticSelection } from './chess-board-haptics';
import type { ChessBoardSounds } from './chess-board-sounds';
import type { Move, Square } from './chess-board-types';
import type { useChessBoardApplyMoveSound } from './use-chess-board-apply-move-sound';
import type { ChessBoardInteractionState } from './use-chess-board-interaction-state';
import type { TryMoveOk, useChessGame } from './use-chess-game';
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
  /** Tap path — commits React UI immediately. */
  tryApplyDrop: (from: Square, to: Square) => boolean;
  /** Drag path — silent rules only; pair with {@link commitDropUi}. */
  applyDropRules: (from: Square, to: Square) => DropOutcome;
  commitDropUi: (result: TryMoveOk) => void;
  onPromotionPick: (p: NonNullable<Move['promotion']>) => void;
  onPromotionCancel: () => void;
};

function buildDropArgs(
  args: ChessBoardHandlersArgs,
  fromSq: Square,
  toSq: Square
): DropAttemptArgs {
  const { interaction, game, rulesFen, sounds, applySuccessfulMove, onMove } =
    args;
  return {
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
  };
}

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

function useDropApply(
  args: ChessBoardHandlersArgs
): Pick<
  ChessBoardHandlers,
  'tryApplyDrop' | 'applyDropRules' | 'commitDropUi'
> {
  const applyRules = useStableHandler((fromSq: Square, toSq: Square) => {
    return applyDropRules(buildDropArgs(args, fromSq, toSq));
  });
  const commitUi = useStableHandler((result: TryMoveOk) => {
    commitDropUi(buildDropArgs(args, result.move.from, result.move.to), result);
  });
  const tryApplyDrop = useStableHandler((fromSq: Square, toSq: Square) => {
    const outcome = applyRules(fromSq, toSq);
    if (outcome.kind === 'promotion') return true;
    if (outcome.kind === 'illegal') return false;
    commitUi(outcome.result);
    return true;
  });
  return {
    tryApplyDrop,
    applyDropRules: applyRules,
    commitDropUi: commitUi,
  };
}

function usePromotionHandlers(
  args: ChessBoardHandlersArgs
): Pick<ChessBoardHandlers, 'onPromotionPick' | 'onPromotionCancel'> {
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
