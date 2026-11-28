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
  fromTick: number,
  /**
   * The control the authority applies from `fromTick` until `input.tick`:
   * the preceding queued input, else the latest acknowledged one; undefined
   * when this device has not controlled the entity since the fence.
   */
  inForce: I | undefined
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
  /** The acknowledged control the authority applies from its latest tick. */
  private inForce: I | undefined = undefined;
  /** Where the latest pending input's projection began: what a superseding input starts from. */
  private origin: {
    readonly state: S;
    readonly fromTick: number;
    readonly inForce: I | undefined;
  };
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
    this.origin = {
      state: snapshot.state,
      fromTick: snapshot.tick,
      inForce: undefined,
    };
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

  /**
   * A full history refuses more input; silently dropping unacknowledged
   * input is unsafe. An input for the latest pending input's own tick
   * supersedes it there: the authority applies both in order, so the later
   * one decides that tick.
   */
  submit(value: I, tick: number): PredictedInput<I> | null {
    const latest = this.pending.at(-1);
    const supersedes = latest !== undefined && tick === latest.tick;
    const previousTick = latest?.tick ?? this.authoritative.tick;
    if (
      (!supersedes && !simulationInteger(tick, previousTick + 1)) ||
      this.pending.length >= this.capacity
    )
      return null;
    if (!Number.isSafeInteger(this.sequence + 1)) return null;
    const input = {
      sequence: this.sequence + 1,
      tick,
      value: structuredClone(value),
    };
    const origin = supersedes
      ? this.origin
      : {
          state: this.predicted,
          fromTick: previousTick,
          inForce: latest?.value ?? this.inForce,
        };
    const predicted = this.project(
      origin.state,
      input,
      origin.fromTick,
      origin.inForce
    );
    this.origin = origin;
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
    for (const input of this.pending)
      if (
        input.sequence <= snapshot.acknowledged &&
        input.tick <= snapshot.tick
      )
        this.inForce = input.value;
    let predicted = snapshot.state;
    let fromTick = snapshot.tick;
    let inForce = this.inForce;
    let origin = { state: predicted, fromTick, inForce };
    const projections = new Map<
      number,
      { readonly tick: number; readonly state: S }
    >();
    for (const [index, input] of pending.entries()) {
      // One superseded at its own tick by a later input never decides it.
      if (pending[index + 1]?.tick === input.tick) continue;
      origin = { state: predicted, fromTick, inForce };
      predicted = this.project(predicted, input, fromTick, inForce);
      inForce = input.value;
      projections.set(input.sequence, { tick: input.tick, state: predicted });
      fromTick = input.tick;
    }
    this.origin = origin;
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
    this.inForce = undefined;
    this.origin = {
      state: snapshot.state,
      fromTick: snapshot.tick,
      inForce: undefined,
    };
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
