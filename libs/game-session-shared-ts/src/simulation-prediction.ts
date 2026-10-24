import { simulationInteger } from '@pkgs/turn-game-shared-ts/simulation';

export type PredictedInput<I> = {
  readonly sequence: number;
  readonly tick: number;
  readonly value: I;
};

export type PredictionSnapshot<S> = {
  /** A match/round fence: an old rematch or connection can never roll back a new one. */
  readonly epoch: string;
  readonly tick: number;
  readonly acknowledged: number;
  readonly state: S;
};

export type PredictionProjection<S, I> = (
  state: S,
  input: PredictedInput<I>
) => S;

/**
 * Only the game's explicitly chosen local projection is predicted. For
 * example, a projection can change one paddle while retaining the authority's
 * ball and score. No generic client is allowed to invent an authoritative result.
 */
export class InputPrediction<S, I> {
  private authoritative: PredictionSnapshot<S>;
  private pending: PredictedInput<I>[] = [];
  private sequence: number;
  private predicted: S;

  constructor(
    snapshot: PredictionSnapshot<S>,
    private readonly project: PredictionProjection<S, I>,
    private readonly capacity: number
  ) {
    if (!simulationInteger(capacity, 1))
      throw new Error('prediction capacity must be positive');
    this.assertSnapshot(snapshot);
    this.authoritative = snapshot;
    this.sequence = snapshot.acknowledged;
    this.predicted = snapshot.state;
  }

  state(): S {
    return this.predicted;
  }

  pendingCount(): number {
    return this.pending.length;
  }

  /** A full history refuses more input; silently dropping unacknowledged input is unsafe. */
  submit(value: I, tick: number): PredictedInput<I> | null {
    const previousTick = this.pending.at(-1)?.tick ?? this.authoritative.tick;
    if (
      !simulationInteger(tick, previousTick + 1) ||
      this.pending.length >= this.capacity
    )
      return null;
    if (!Number.isSafeInteger(this.sequence + 1)) return null;
    const input = {
      sequence: this.sequence + 1,
      tick,
      value: structuredClone(value),
    };
    const predicted = this.project(this.predicted, input);
    this.sequence = input.sequence;
    this.pending.push(input);
    this.predicted = predicted;
    return input;
  }

  reconcile(snapshot: PredictionSnapshot<S>): boolean {
    this.assertSnapshot(snapshot);
    if (
      snapshot.epoch !== this.authoritative.epoch ||
      snapshot.tick <= this.authoritative.tick ||
      snapshot.acknowledged < this.authoritative.acknowledged ||
      snapshot.acknowledged > this.sequence
    )
      return false;
    const pending = this.pending.filter(
      (input) =>
        input.sequence > snapshot.acknowledged && input.tick > snapshot.tick
    );
    const predicted = pending.reduce(this.project, snapshot.state);
    this.authoritative = snapshot;
    this.pending = pending;
    this.predicted = predicted;
    return true;
  }

  /** Explicit reconnect replaces the fence and sequence, discarding offline controls. */
  reset(snapshot: PredictionSnapshot<S>): void {
    this.assertSnapshot(snapshot);
    this.authoritative = snapshot;
    this.sequence = snapshot.acknowledged;
    this.predicted = snapshot.state;
    this.pending = [];
  }

  private assertSnapshot(snapshot: PredictionSnapshot<S>): void {
    if (
      snapshot.epoch.length === 0 ||
      !simulationInteger(snapshot.tick, 0) ||
      !simulationInteger(snapshot.acknowledged, 0)
    )
      throw new Error('invalid prediction snapshot');
  }
}
