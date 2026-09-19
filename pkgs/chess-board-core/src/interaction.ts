/**
 * Framework-free tap / drag / promotion / premove state machine over a
 * {@link BoardRulesPort} (live {@link ChessGame} or controlled dests).
 */

import type { BoardRulesPort } from './board-rules';
import type { TryMoveOk } from './game';
import { indexFromSquare } from './geometry';
import {
  createPremoveController,
  type PremoveController,
} from './premove/premove-controller';
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
  /** Head of the premove queue (first to flush). */
  readonly premove: BoardPremmove | null;
  /** Full premove queue (multi-premove). */
  readonly premves: readonly BoardPremmove[];
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
 * Tap semantics: tapping one of the mover's pieces selects it; tapping the
 * selection again clears it; tapping anything else attempts the move.
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
  private readonly premoveCtl: PremoveController;

  constructor(
    private readonly rules: BoardRulesPort,
    private readonly hooks: BoardInteractionHooks = {},
    interactive = true,
    premoveMax = 5
  ) {
    this.premoveCtl = createPremoveController(premoveMax);
    this.snapshot = {
      interactive,
      selected: null,
      dragFrom: null,
      pendingPromotion: null,
      premove: null,
      premves: [],
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
      this.premoveCtl.clear();
      this.publishPremoves();
    }
  }

  setPremoveMax(max: number): void {
    this.premoveCtl.queue.setMax(max);
    this.publishPremoves();
  }

  private publishPremoves(): void {
    this.publish({
      premove: this.premoveCtl.current(),
      premves: this.premoveCtl.all(),
    });
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
    if (this.ownsPiece(origin)) return this.rules.legalTargetsFrom(origin);
    if (this.isPremovable(origin)) {
      return this.rules.premoveTargetsFrom(origin);
    }
    return EMPTY_TARGETS;
  }

  private ownsPiece(square: Square): boolean {
    return this.rules.ownsMovable(square);
  }

  private isPremovable(square: Square): boolean {
    return this.rules.isPremovable(
      square,
      this.playerColor,
      this.premovesEnabled
    );
  }

  setInteractive(interactive: boolean): void {
    if (interactive === this.snapshot.interactive) return;
    if (interactive) {
      this.publish({ interactive });
      return;
    }
    this.premoveCtl.clear();
    this.publish({
      interactive,
      selected: null,
      dragFrom: null,
      pendingPromotion: null,
      premove: null,
      premves: [],
    });
  }

  /** Drop everything transient (parent reset / FEN swap). */
  clear(opts?: { readonly retainPremmove?: boolean }): void {
    if (opts?.retainPremmove !== true) this.premoveCtl.clear();
    this.publish({
      selected: null,
      dragFrom: null,
      pendingPromotion: null,
      premove: this.premoveCtl.current(),
      premves: this.premoveCtl.all(),
    });
  }

  /** Gestures are ignored while off or while the promotion picker is open. */
  private acceptsGestures(): boolean {
    return this.snapshot.interactive && this.snapshot.pendingPromotion === null;
  }

  tap(square: Square): void {
    const { selected, premove } = this.snapshot;
    if (!this.acceptsGestures()) return;
    if (
      selected === null &&
      premove !== null &&
      !this.ownsPiece(square) &&
      !this.isPremovable(square)
    ) {
      this.premoveCtl.clear();
      this.publishPremoves();
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
    if (this.reselects(square)) {
      this.publish({ selected: square });
      this.hooks.onSelect?.(square);
      return;
    }
    this.publish({ selected: null });
    this.drop(selected, square);
  }

  /** Tapping another of your pieces (not a legal target) moves the selection. */
  private reselects(square: Square): boolean {
    if (this.snapshot.legalTargets.includes(square)) return false;
    return this.ownsPiece(square) || this.isPremovable(square);
  }

  canDrag(square: Square): boolean {
    if (!this.acceptsGestures()) return false;
    return this.ownsPiece(square) || this.isPremovable(square);
  }

  beginDrag(square: Square): boolean {
    if (!this.canDrag(square)) return false;
    this.publish({ dragFrom: square, selected: null });
    return true;
  }

  cancelDrag(): void {
    if (this.snapshot.dragFrom === null) return;
    this.publish({ dragFrom: null });
  }

  drop(from: Square, to: Square): DropOutcome {
    if (this.isPremovable(from) && !this.ownsPiece(from)) {
      const premove: BoardPremmove = { from, to };
      this.premoveCtl.enqueue(premove);
      this.publish({
        dragFrom: null,
        selected: null,
        premove: this.premoveCtl.current(),
        premves: this.premoveCtl.all(),
      });
      return { kind: 'premove', premove };
    }
    if (this.rules.moveRequiresPromotion(from, to)) {
      if (this.autoPromoteQueen) {
        return this.applyMove({ from, to, promotion: 'q' });
      }
      const position = this.rules.getPosition();
      const pending: PendingPromotion = {
        from,
        to,
        color: position[indexFromSquare(from)]?.color ?? this.rules.getTurn(),
      };
      this.publish({ dragFrom: null, pendingPromotion: pending });
      return { kind: 'promotion', pending };
    }
    return this.applyMove({ from, to });
  }

  private applyMove(move: Move): DropOutcome {
    const result = this.rules.tryMove(move);
    if (!result.ok) {
      this.publish({ dragFrom: null });
      this.hooks.onIllegal?.(move.from, move.to);
      return { kind: 'illegal' };
    }
    this.publish({
      dragFrom: null,
      pendingPromotion: null,
      premove: this.premoveCtl.current(),
      premves: this.premoveCtl.all(),
    });
    this.hooks.onApplied?.(result);
    return { kind: 'applied', result };
  }

  /**
   * Play the head of the premove queue once it is the player's turn. While
   * the opponent is still to move the queue is left intact; a premove whose
   * piece is gone (captured) is dropped.
   */
  flushPremmove(): DropOutcome | null {
    if (this.premoveCtl.current() === null) return null;
    if (this.rules.getTurn() !== this.playerColor) return null;
    const queued = this.premoveCtl.shift();
    this.publishPremoves();
    if (queued === null) return null;
    if (!this.ownsPiece(queued.from)) return null;
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
    const result = this.rules.tryMove({
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
