import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { simulationInteger } from '@pkgs/turn-game-shared-ts/simulation';

type SentInputs = { latest: number; readonly sent: Map<number, number> };

/** Same-clock submission-to-acknowledgment durations, with bounded retention. */
export class SimulationInputTiming {
  private readonly players = new Map<GameSide, SentInputs>();

  constructor(private readonly capacity: number) {
    if (!simulationInteger(capacity, 1))
      throw new Error('input timing capacity must be positive');
  }

  record(side: GameSide, sequence: number, at: number): boolean {
    const player = this.players.get(side) ?? { latest: 0, sent: new Map() };
    if (
      !simulationInteger(sequence, player.latest + 1) ||
      !Number.isFinite(at) ||
      player.sent.size >= this.capacity
    )
      return false;
    player.latest = sequence;
    player.sent.set(sequence, at);
    this.players.set(side, player);
    return true;
  }

  acknowledge(side: GameSide, sequence: number, at: number): number[] {
    const player = this.players.get(side);
    if (!Number.isFinite(at) || !player?.sent.has(sequence)) return [];
    const durations: number[] = [];
    for (const [sentSequence, sentAt] of player.sent) {
      if (sentSequence > sequence) break;
      player.sent.delete(sentSequence);
      if (at >= sentAt) durations.push(at - sentAt);
    }
    return durations;
  }

  clear(): void {
    this.players.clear();
  }
}
