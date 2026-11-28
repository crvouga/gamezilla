import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';

type SideCommands = { sequence: number; outstanding: number[] };

/**
 * A device's discrete commands awaiting the authority: each sequence is sent
 * once, at most `capacity` stay unanswered per seat, and an acknowledgment,
 * a new round or a new epoch releases them. Commands are never resent, so a
 * returning device cannot replay a burst of stale turns.
 */
export class SimulationCommandOutbox {
  private readonly seats = new Map<GameSide, SideCommands>();
  private round: number | undefined;

  constructor(private readonly capacity: number) {
    if (!Number.isSafeInteger(capacity) || capacity < 1)
      throw new Error('command outbox capacity must be positive');
  }

  /** The next sequence for `side`, or null while its outstanding commands are full. */
  next(side: GameSide, acknowledged: number | undefined): number | null {
    const seat = this.seats.get(side) ?? {
      sequence: acknowledged ?? 0,
      outstanding: [],
    };
    if (
      seat.outstanding.length >= this.capacity ||
      !Number.isSafeInteger(seat.sequence + 1)
    )
      return null;
    seat.sequence = Math.max(seat.sequence, acknowledged ?? 0) + 1;
    seat.outstanding.push(seat.sequence);
    this.seats.set(side, seat);
    return seat.sequence;
  }

  /** Answered commands leave; a changed round abandons every outstanding one. */
  acknowledge(
    acknowledged: Readonly<Record<string, number>>,
    round: number | undefined
  ): void {
    const roundChanged = round !== this.round;
    this.round = round;
    for (const [side, seat] of this.seats) {
      const answered = acknowledged[side] ?? 0;
      seat.sequence = Math.max(seat.sequence, answered);
      seat.outstanding = roundChanged
        ? []
        : seat.outstanding.filter((sequence) => sequence > answered);
    }
  }

  /** A new epoch restarts sequences from the authority's acknowledgments. */
  reset(acknowledged: Readonly<Record<string, number>>): void {
    this.seats.clear();
    this.round = undefined;
    for (const [side, sequence] of Object.entries(acknowledged))
      this.seats.set(side as GameSide, { sequence, outstanding: [] });
  }

  outstanding(): number {
    let count = 0;
    for (const seat of this.seats.values()) count += seat.outstanding.length;
    return count;
  }

  sides(): readonly GameSide[] {
    return [...this.seats.keys()];
  }
}
