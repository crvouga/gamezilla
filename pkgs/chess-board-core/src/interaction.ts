import type { ChessGame, TryMoveOk } from './game';
import { indexFromSquare } from './geometry';
import type { Move, PieceColor, Square } from './types';

export type PendingPromotion = {
  readonly from: Square;
  readonly to: Square;
  readonly color: PieceColor;
};

export type BoardPremmove = {
  readonly from: Square;
  readonly to: Square;
  readonly promotion?: NonNullable<Move['promotion']>;
};

export type BoardInteractionSnapshot = {
  readonly interactive: boolean;
  readonly selected: Square | null;
  readonly dragFrom: Square | null;
  readonly pendingPromotion: PendingPromotion | null;
  readonly premove: BoardPremmove | null;
  /** Legal destinations for `selected ?? dragFrom` (empty otherwise). */
  readonly legalTargets: readonly Square[];
};

export type DropOutcome =
  | { readonly kind: 'promotion'; readonly pending: PendingPromotion }
  | { readonly kind: 'illegal' }
  | { readonly kind: 'applied'; readonly result: TryMoveOk }
  | { readonly kind: 'premove'; readonly premove: BoardPremmove };

/** Side effects the view layer wires (sounds, haptics, parent callbacks). */
export type BoardInteractionHooks = {
  readonly onApplied?: (result: TryMoveOk) => void;
  readonly onIllegal?: (from: Square, to: Square) => void;
  readonly onSelect?: (square: Square) => void;
  readonly onPromotionCancel?: () => void;
};

const EMPTY_TARGETS: readonly Square[] = Object.freeze([]);

/**
 * Framework-free tap / drag / promotion / premove state machine over
 * {@link ChessGame}.
 *
 * Tap semantics: tapping one of the side-to-move's pieces selects it; tapping
 * the selection again clears it; tapping anything else attempts the move.
 * When premoves are enabled and it is the opponent's turn, the same gestures
 * on your pieces queue a single premove that {@link flushPremmove} applies
 * once it is your turn.
 */
export class BoardInteraction {
  private snapshot: BoardInteractionSnapshot;
  private readonly listeners = new Set<() => void>();
  private premovesEnabled = false;
  private autoPromoteQueen = false;
  private playerColor: PieceColor | null = null;

  constructor(
    private readonly game: ChessGame,
    private readonly hooks: BoardInteractionHooks = {},
    interactive = true
  ) {
    this.snapshot = {
      interactive,
      selected: null,
      dragFrom: null,
      pendingPromotion: null,
      premove: null,
      legalTargets: EMPTY_TARGETS,
    };
  }

  getSnapshot = (): BoardInteractionSnapshot => this.snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  setPremovesEnabled(enabled: boolean): void {
    if (this.premovesEnabled === enabled) return;
    this.premovesEnabled = enabled;
    if (!enabled && this.snapshot.premove !== null) {
      this.publish({ premove: null });
    }
  }

  /** Color that queues premoves (usually the seated / oriented side). */
  setPlayerColor(color: PieceColor | null): void {
    this.playerColor = color;
  }

  setAutoPromoteQueen(enabled: boolean): void {
    this.autoPromoteQueen = enabled;
  }

  private publish(patch: Partial<BoardInteractionSnapshot>): void {
    const next = { ...this.snapshot, ...patch };
    const origin = next.selected ?? next.dragFrom;
    next.legalTargets =
      origin === null ? EMPTY_TARGETS : this.targetsFrom(origin);
    this.snapshot = next;
    for (const listener of [...this.listeners]) listener();
  }

  private targetsFrom(origin: Square): readonly Square[] {
    if (this.ownsPiece(origin)) return this.game.legalMovesFrom(origin);
    if (this.isPremovable(origin)) {
      return this.game.premoveTargetsFrom(origin);
    }
    return EMPTY_TARGETS;
  }

  private ownsPiece(square: Square): boolean {
    const { position, turn } = this.game.getSnapshot();
    return position[indexFromSquare(square)]?.color === turn;
  }

  /** Your piece while the opponent is to move (premove candidate). */
  private isPremovable(square: Square): boolean {
    if (!this.premovesEnabled) return false;
    const player = this.playerColor;
    if (player === null) return false;
    const { position, turn } = this.game.getSnapshot();
    if (turn === player) return false;
    const piece = position[indexFromSquare(square)];
    return piece !== null && piece !== undefined && piece.color === player;
  }

  setInteractive(interactive: boolean): void {
    if (interactive === this.snapshot.interactive) return;
    if (interactive) {
      this.publish({ interactive });
      return;
    }
    this.publish({
      interactive,
      selected: null,
      dragFrom: null,
      pendingPromotion: null,
      premove: null,
    });
  }

  /** Drop everything transient (parent reset / FEN swap). */
  clear(opts?: { readonly retainPremmove?: boolean }): void {
    this.publish({
      selected: null,
      dragFrom: null,
      pendingPromotion: null,
      ...(opts?.retainPremmove === true ? {} : { premove: null }),
    });
  }

  tap(square: Square): void {
    const { interactive, selected, premove } = this.snapshot;
    if (!interactive) return;
    // Click away clears a queued premove when not selecting/moving.
    if (
      selected === null &&
      premove !== null &&
      !this.ownsPiece(square) &&
      !this.isPremovable(square)
    ) {
      this.publish({ premove: null });
      return;
    }
    if (selected === null) {
      if (this.ownsPiece(square) || this.isPremovable(square)) {
        this.publish({ selected: square });
        this.hooks.onSelect?.(square);
      }
      return;
    }
    if (square === selected) {
      this.publish({ selected: null });
      return;
    }
    this.publish({ selected: null });
    this.drop(selected, square);
  }

  /** True when `square` can start a drag (own turn piece or premovable). */
  canDrag(square: Square): boolean {
    if (!this.snapshot.interactive) return false;
    return this.ownsPiece(square) || this.isPremovable(square);
  }

  /** Start dragging `square`; false when it cannot be dragged. */
  beginDrag(square: Square): boolean {
    if (!this.canDrag(square)) return false;
    this.publish({ dragFrom: square, selected: null });
    return true;
  }

  cancelDrag(): void {
    if (this.snapshot.dragFrom === null) return;
    this.publish({ dragFrom: null });
  }

  /** Attempt `from → to`; promotions park until picked; premoves queue. */
  drop(from: Square, to: Square): DropOutcome {
    if (this.isPremovable(from) && !this.ownsPiece(from)) {
      const premove: BoardPremmove = { from, to };
      this.publish({ dragFrom: null, premove, selected: null });
      return { kind: 'premove', premove };
    }
    if (this.game.moveRequiresPromotion(from, to)) {
      if (this.autoPromoteQueen) {
        return this.applyMove({ from, to, promotion: 'q' });
      }
      const { position, turn } = this.game.getSnapshot();
      const pending: PendingPromotion = {
        from,
        to,
        color: position[indexFromSquare(from)]?.color ?? turn,
      };
      this.publish({ dragFrom: null, pendingPromotion: pending });
      return { kind: 'promotion', pending };
    }
    return this.applyMove({ from, to });
  }

  private applyMove(move: Move): DropOutcome {
    const result = this.game.tryMove(move);
    if (!result.ok) {
      this.publish({ dragFrom: null });
      this.hooks.onIllegal?.(move.from, move.to);
      return { kind: 'illegal' };
    }
    this.publish({ dragFrom: null, pendingPromotion: null, premove: null });
    this.hooks.onApplied?.(result);
    return { kind: 'applied', result };
  }

  /**
   * When it becomes the side-to-move for a queued premove, try to apply it.
   * Clears the queue whether the move succeeds or not.
   */
  flushPremmove(): DropOutcome | null {
    const queued = this.snapshot.premove;
    if (queued === null) return null;
    if (!this.ownsPiece(queued.from)) return null;
    this.publish({ premove: null });
    if (queued.promotion !== undefined) {
      return this.applyMove({
        from: queued.from,
        to: queued.to,
        promotion: queued.promotion,
      });
    }
    return this.drop(queued.from, queued.to);
  }

  pickPromotion(promotion: NonNullable<Move['promotion']>): boolean {
    const pending = this.snapshot.pendingPromotion;
    if (pending === null) return false;
    this.publish({ pendingPromotion: null });
    const result = this.game.tryMove({
      from: pending.from,
      to: pending.to,
      promotion,
    });
    if (!result.ok) {
      this.hooks.onIllegal?.(pending.from, pending.to);
      return false;
    }
    this.hooks.onApplied?.(result);
    return true;
  }

  cancelPromotion(): void {
    if (this.snapshot.pendingPromotion === null) return;
    this.publish({ pendingPromotion: null });
    this.hooks.onPromotionCancel?.();
  }
}
