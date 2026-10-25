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
  input: PredictedInput<I>,
  /** Logical origin after the latest authority update or preceding queued input. */
  fromTick: number
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
  private projections = new Map<
    number,
    { readonly tick: number; readonly state: S }
  >();

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

  /** A projection at this exact acknowledged tick, never the current future pose. */
  projectedStateAt(
    snapshot: Pick<PredictionSnapshot<S>, 'epoch' | 'tick' | 'acknowledged'>
  ): S | null {
    if (snapshot.epoch !== this.authoritative.epoch) return null;
    const projection = this.projections.get(snapshot.acknowledged);
    return projection?.tick === snapshot.tick ? projection.state : null;
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
    const predicted = this.project(this.predicted, input, previousTick);
    this.sequence = input.sequence;
    this.pending.push(input);
    this.predicted = predicted;
    this.projections.set(input.sequence, { tick, state: predicted });
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
    let predicted = snapshot.state;
    let fromTick = snapshot.tick;
    const projections = new Map<
      number,
      { readonly tick: number; readonly state: S }
    >();
    for (const input of pending) {
      predicted = this.project(predicted, input, fromTick);
      projections.set(input.sequence, { tick: input.tick, state: predicted });
      fromTick = input.tick;
    }
    this.authoritative = snapshot;
    this.pending = pending;
    this.predicted = predicted;
    this.projections = projections;
    return true;
  }

  /** Explicit reconnect replaces the fence and sequence, discarding offline controls. */
  reset(snapshot: PredictionSnapshot<S>): void {
    this.assertSnapshot(snapshot);
    this.authoritative = snapshot;
    this.sequence = snapshot.acknowledged;
    this.predicted = snapshot.state;
    this.pending = [];
    this.projections.clear();
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
