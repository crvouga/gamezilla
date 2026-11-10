import type { Random } from '@pkgs/uuid-shared-ts/create-id';
import { drawThinkingMs } from './thinking-time';

/**
 * When a Synthetic User makes its move: once it has thought about the
 * position for a human-like time, drawn when it first sees its move.
 */
export class MovePacing {
  private position: string | null = null;
  private moveAt = 0;
  private planned = 0;
  constructor(
    private readonly bounds: { readonly minMs: number; readonly maxMs: number },
    private readonly random: Random,
    private previousMs: number | null
  ) {}
  /** Whether the Synthetic User has thought long enough to move in `position`. */
  ready(position: string, nowMs: number): boolean {
    if (this.position !== position) {
      this.position = position;
      this.planned = drawThinkingMs(this.bounds, this.previousMs, this.random);
      this.moveAt = nowMs + this.planned;
    }
    return nowMs >= this.moveAt;
  }
  /** The move in the current position was made: its thinking time is the previous one now. */
  moved(): void {
    this.previousMs = this.planned;
  }
  /** Forget a position that is no longer to move in. */
  idle(): void {
    this.position = null;
  }
  /** When the Synthetic User means to move next; `null` while it has nothing to think about. */
  wakeAt(): number | null {
    return this.position === null ? null : this.moveAt;
  }
}
