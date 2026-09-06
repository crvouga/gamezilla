import type { ChessGame, TryMoveOk } from './game';
import { indexFromSquare } from './geometry';
import type { Move, PieceColor, Square } from './types';

export type PendingPromotion = {
  readonly from: Square;
  readonly to: Square;
  readonly color: PieceColor;
};

export type BoardInteractionSnapshot = {
  readonly interactive: boolean;
  readonly selected: Square | null;
  readonly dragFrom: Square | null;
  readonly pendingPromotion: PendingPromotion | null;
  /** Legal destinations for `selected ?? dragFrom` (empty otherwise). */
  readonly legalTargets: readonly Square[];
};

export type DropOutcome =
  | { readonly kind: 'promotion'; readonly pending: PendingPromotion }
  | { readonly kind: 'illegal' }
  | { readonly kind: 'applied'; readonly result: TryMoveOk };

/** Side effects the view layer wires (sounds, haptics, parent callbacks). */
export type BoardInteractionHooks = {
  readonly onApplied?: (result: TryMoveOk) => void;
  readonly onIllegal?: (from: Square, to: Square) => void;
  readonly onSelect?: (square: Square) => void;
  readonly onPromotionCancel?: () => void;
};

const EMPTY_TARGETS: readonly Square[] = Object.freeze([]);

/**
 * Framework-free tap / drag / promotion state machine over {@link ChessGame}.
 *
 * Tap semantics: tapping one of the side-to-move's pieces selects it; tapping
 * the selection again clears it; tapping anything else attempts the move.
 * Drops go through the same rules; pawn promotions park a `pendingPromotion`
 * until {@link pickPromotion} / {@link cancelPromotion}.
 */
export class BoardInteraction {
  private snapshot: BoardInteractionSnapshot;
  private readonly listeners = new Set<() => void>();

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

  private publish(patch: Partial<BoardInteractionSnapshot>): void {
    const next = { ...this.snapshot, ...patch };
    const origin = next.selected ?? next.dragFrom;
    next.legalTargets =
      origin === null ? EMPTY_TARGETS : this.game.legalMovesFrom(origin);
    this.snapshot = next;
    for (const listener of [...this.listeners]) listener();
  }

  private ownsPiece(square: Square): boolean {
    const { position, turn } = this.game.getSnapshot();
    return position[indexFromSquare(square)]?.color === turn;
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
    });
  }

  /** Drop everything transient (parent reset / FEN swap). */
  clear(): void {
    this.publish({ selected: null, dragFrom: null, pendingPromotion: null });
  }

  tap(square: Square): void {
    const { interactive, selected } = this.snapshot;
    if (!interactive) return;
    if (selected === null) {
      if (this.ownsPiece(square)) {
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

  /** Start dragging `square`; false when it is not the mover's piece. */
  beginDrag(square: Square): boolean {
    if (!this.snapshot.interactive || !this.ownsPiece(square)) return false;
    this.publish({ dragFrom: square, selected: null });
    return true;
  }

  cancelDrag(): void {
    if (this.snapshot.dragFrom === null) return;
    this.publish({ dragFrom: null });
  }

  /** Attempt `from → to`; promotions park until picked. */
  drop(from: Square, to: Square): DropOutcome {
    if (this.game.moveRequiresPromotion(from, to)) {
      const { position, turn } = this.game.getSnapshot();
      const pending: PendingPromotion = {
        from,
        to,
        color: position[indexFromSquare(from)]?.color ?? turn,
      };
      this.publish({ dragFrom: null, pendingPromotion: pending });
      return { kind: 'promotion', pending };
    }
    const result = this.game.tryMove({ from, to });
    if (!result.ok) {
      this.publish({ dragFrom: null });
      this.hooks.onIllegal?.(from, to);
      return { kind: 'illegal' };
    }
    this.publish({ dragFrom: null });
    this.hooks.onApplied?.(result);
    return { kind: 'applied', result };
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
