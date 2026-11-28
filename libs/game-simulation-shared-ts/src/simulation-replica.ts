import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  type RegisteredSimulation,
  simulationInputPolicy,
} from '@pkgs/turn-game-shared-ts/game-simulation';
import { SimulationCommandOutbox } from './simulation-command-outbox';
import { SimulationInputTiming } from './simulation-input-timing';
import {
  createPlaybackClock,
  type PlaybackClock,
  SnapshotInterpolation,
} from './simulation-interpolation';
import {
  type SimulationSnapshotPayload,
  SimulationStateChanged,
  SubmitSimulationInput,
} from './simulation-messages';
import { InputPrediction } from './simulation-prediction';

type LocalControl = {
  prediction: InputPrediction<unknown, unknown>;
  tick: number;
  /** When this side's latest input left the device, and what it held. */
  submittedAt: number;
  submitted: unknown;
  /** The predicted entity just before the latest input's tick, where its motion starts. */
  base: unknown;
};

/** What a replica reports: on each court it receives, and once a second. */
export type SimulationReplicaSample = {
  readonly snapshotAgeMs: number;
  /** Authority now to the court shown, for interpolated play; null otherwise. */
  readonly presentationDelayMs: number | null;
  /** Since the previous court of the same running game, on a court's arrival. */
  readonly arrivalIntervalMs: number | null;
  /** Times the playback clock jumped since this replica began. */
  readonly playbackSnaps: number;
  /** Times this replica re-read the authority since it began. */
  readonly resyncs: number;
  /** A changed local control to the first frame that showed it, since the last sample. */
  readonly inputRenderMs: readonly number[];
  readonly pendingInputs: number;
  readonly reconciled: boolean;
  readonly acknowledgmentMs: readonly number[];
  readonly predictionErrors: readonly number[];
};

/** Presentation-only replica: scores and remote entities always come from the room authority. */
export class SimulationReplica {
  private latest: SimulationSnapshotPayload | null = null;
  private receivedAt = 0;
  private lastSentAt = -Infinity;
  private lastChangeSentAt = -Infinity;
  private measuredAt = -Infinity;
  private presentationTick = -Infinity;
  private resynchronized = 0;
  /** When each side's control last changed, until a frame shows it. */
  private readonly changedAt = new Map<GameSide, number>();
  private inputRenderMs: number[] = [];
  private readonly playback: PlaybackClock;
  private readonly inputTiming;
  private readonly interpolation;
  private readonly controls = new Map<GameSide, LocalControl>();
  private readonly held = new Map<GameSide, unknown>();
  /** Sides whose held control changed since it last left the device. */
  private readonly changed = new Set<GameSide>();
  /** The court a held control was chosen on, kept while a refresh re-reads it. */
  private heldOn: { readonly epoch: string; readonly paused: boolean } | null =
    null;
  private readonly commands: SimulationCommandOutbox | null;

  constructor(
    private readonly options: {
      readonly simulation: RegisteredSimulation;
      readonly clock: Clock;
      readonly send: (message: Message) => string | null;
      readonly measure: (sample: SimulationReplicaSample) => void;
    }
  ) {
    this.playback = createPlaybackClock(options.simulation.timing);
    this.inputTiming = new SimulationInputTiming(
      Math.min(64, options.simulation.timing.maxQueuedInputs)
    );
    const policy = simulationInputPolicy(options.simulation);
    this.commands =
      policy.mode === 'commands'
        ? new SimulationCommandOutbox(
            Math.min(64, 2 * policy.maxPendingPerPlayer)
          )
        : null;
    this.interpolation = new SnapshotInterpolation<unknown>(
      options.simulation.presentation?.interpolate ??
        ((_before, after) => after),
      8
    );
  }

  receive(message: Message, expectedEpoch: string): boolean {
    if (
      !SimulationStateChanged.is(message) ||
      message.payload.epoch !== expectedEpoch
    )
      return false;
    const snapshot = message.payload;
    const previous = this.latest;
    if (
      previous?.epoch === snapshot.epoch &&
      (snapshot.revision <= previous.revision || snapshot.tick < previous.tick)
    )
      return false;
    const state = this.options.simulation.codec.decode(snapshot.state);
    if (state === null) return false;
    if (
      previous?.epoch !== snapshot.epoch ||
      previous.paused !== snapshot.paused
    ) {
      this.controls.clear();
      this.inputTiming.clear();
      const heldOn = previous ?? this.heldOn;
      if (heldOn?.epoch !== snapshot.epoch || heldOn.paused !== snapshot.paused)
        this.held.clear();
      this.commands?.reset(snapshot.acknowledged);
      this.interpolation.reset();
      this.playback.reset();
      this.presentationTick = -Infinity;
    }
    const arrivalMs = this.receivedAt;
    this.latest = snapshot;
    this.heldOn = null;
    this.commands?.acknowledge(
      snapshot.acknowledged,
      this.options.simulation.rounds?.current(state)
    );
    this.receivedAt = this.options.clock.now();
    if (!snapshot.paused) this.playback.arrive(snapshot.tick, this.receivedAt);
    this.interpolation.push({ tick: snapshot.tick, state });
    const measures = this.reconcile(snapshot, state, previous?.tick ?? -1);
    this.measure(
      previous !== null,
      measures.acknowledgmentMs,
      measures.predictionErrors,
      previous?.epoch === snapshot.epoch && !snapshot.paused
        ? this.receivedAt - arrivalMs
        : null
    );
    return true;
  }

  private reconcile(
    snapshot: SimulationSnapshotPayload,
    state: unknown,
    previousTick: number
  ) {
    const acknowledgmentMs: number[] = [];
    const predictionErrors: number[] = [];
    if (this.commands !== null)
      for (const side of this.commands.sides())
        acknowledgmentMs.push(
          ...this.inputTiming.acknowledge(
            side,
            snapshot.acknowledged[side] ?? 0,
            this.receivedAt
          )
        );
    for (const [side, control] of this.controls) {
      acknowledgmentMs.push(
        ...this.inputTiming.acknowledge(
          side,
          snapshot.acknowledged[side] ?? 0,
          this.receivedAt
        )
      );
      const progress = {
        epoch: snapshot.epoch,
        tick: snapshot.tick,
        acknowledged: snapshot.acknowledged[side] ?? 0,
        state,
      };
      const projected = control.prediction.projectedStateAt(progress);
      const accepted = control.prediction.reconcile(progress);
      if (!accepted && snapshot.tick > previousTick)
        control.prediction.reset(progress);
      if (accepted && projected !== null) {
        const error = this.predictionError(projected, state, side);
        if (error !== null) predictionErrors.push(error);
      }
    }
    return { acknowledgmentMs, predictionErrors };
  }

  private predictionError(
    predicted: unknown,
    authoritative: unknown,
    side: GameSide
  ): number | null {
    const presentation = this.options.simulation.presentation;
    if (
      presentation?.predict === undefined ||
      presentation.predictionError === undefined
    )
      return null;
    const error = presentation.predictionError(predicted, authoritative, side);
    return error !== null && Number.isFinite(error) && error >= 0 && error <= 1
      ? error
      : null;
  }

  /** A held control is coalesced for `pump`; a command is sent once, now. */
  control(side: GameSide, input: unknown): boolean {
    const value = this.options.simulation.parseInput(input);
    if (value === null || this.latest === null || this.latest.paused)
      return false;
    if (this.commands !== null) return this.command(side, value);
    const previous = this.held.get(side);
    this.held.set(side, value);
    // A changed control leaves now, not at the next periodic refresh.
    if (
      previous === undefined ||
      JSON.stringify(previous) !== JSON.stringify(value)
    ) {
      if (!this.changedAt.has(side))
        this.changedAt.set(side, this.options.clock.now());
      this.changed.add(side);
      this.pump();
    }
    return true;
  }

  private command(side: GameSide, value: unknown): boolean {
    const snapshot = this.latest!;
    if (this.isStale()) return false;
    const sequence = this.commands!.next(side, snapshot.acknowledged[side]);
    if (sequence === null) return false;
    this.inputTiming.record(side, sequence, this.options.clock.now());
    const sent = this.options.send(
      SubmitSimulationInput({
        version: 1,
        epoch: snapshot.epoch,
        playerId: side,
        sequence,
        tick: snapshot.tick,
        value,
      })
    );
    if (sent === null) {
      this.reset();
      return false;
    }
    return true;
  }

  /**
   * Coalesces raw device events; periodic held input also bounds the game's
   * input lease. A changed control leaves at once, unless another change
   * left within the refresh interval (a drag changes it every event), when it
   * leaves with the next refresh.
   */
  pump(): void {
    const snapshot = this.latest;
    const now = this.options.clock.now();
    const timing = this.options.simulation.timing;
    const refreshMs = 1000 / Math.min(30, timing.tickRate);
    const immediate =
      this.changed.size > 0 && now - this.lastChangeSentAt >= refreshMs;
    if (
      this.commands !== null ||
      snapshot === null ||
      snapshot.paused ||
      now - this.receivedAt > 1000 ||
      // A frame's rounding must not push a refresh to the frame after.
      (!immediate && now - this.lastSentAt < refreshMs - 1)
    )
      return;
    this.lastSentAt = now;
    if (this.changed.size > 0) this.lastChangeSentAt = now;
    // The authority's tick now, from its smoothed clock: consecutive inputs
    // are as many ticks apart as the time between them.
    const current = this.playback.started()
      ? Math.max(snapshot.tick, Math.ceil(this.playback.authorityTick(now)))
      : snapshot.tick +
        Math.ceil(
          (Math.max(0, now - this.receivedAt) * timing.tickRate) / 1000
        );
    const tick = current + 3;
    if (tick - snapshot.tick > timing.maxInputLeadTicks) return;
    for (const [side, value] of this.held)
      this.submit(side, value, tick, this.changed.has(side));
    this.changed.clear();
  }

  private submit(
    side: GameSide,
    value: unknown,
    tick: number,
    changed: boolean
  ): void {
    const snapshot = this.latest!;
    let control = this.controls.get(side);
    if (control === undefined) {
      const project = this.options.simulation.presentation?.predict;
      const state = this.options.simulation.codec.decode(snapshot.state)!;
      control = {
        tick: snapshot.tick,
        submittedAt: this.options.clock.now(),
        submitted: undefined,
        base: undefined,
        prediction: new InputPrediction<unknown, unknown>(
          {
            epoch: snapshot.epoch,
            tick: snapshot.tick,
            acknowledged: snapshot.acknowledged[side] ?? 0,
            state,
          },
          // The authority applies an input from its own tick on; until
          // then the control in force moves the entity.
          (previous, input, fromTick, inForce) => {
            if (project === undefined) return previous;
            const tickMs = 1000 / this.options.simulation.timing.tickRate;
            const before = Math.min(100, (input.tick - fromTick - 1) * tickMs);
            const carried =
              inForce === undefined || before <= 0
                ? previous
                : project(previous, side, inForce, before);
            const own = this.controls.get(side);
            if (own !== undefined) own.base = carried;
            return project(carried, side, input.value, tickMs);
          },
          Math.min(64, this.options.simulation.timing.maxQueuedInputs)
        ),
      };
      this.controls.set(side, control);
    }
    // A change in the tick an input already took supersedes it there, so it
    // starts when it was made; an unchanged refresh waits for the next tick.
    const supersedes =
      changed && tick <= control.tick && control.tick > snapshot.tick;
    if (!supersedes && tick <= control.tick) return;
    const at = supersedes ? control.tick : tick;
    const input = control.prediction.submit(value, at);
    if (input === null) return;
    control.tick = at;
    if (!supersedes) control.submittedAt = this.options.clock.now();
    control.submitted = value;
    this.inputTiming.record(side, input.sequence, this.options.clock.now());
    const sent = this.options.send(
      SubmitSimulationInput({
        version: 1,
        epoch: snapshot.epoch,
        playerId: side,
        sequence: input.sequence,
        tick: at,
        value,
      })
    );
    if (sent === null) this.reset();
  }

  sample(): unknown | null {
    const snapshot = this.latest;
    if (snapshot === null) return null;
    const now = this.options.clock.now();
    if (now - this.measuredAt >= 1000) {
      this.measuredAt = now;
      this.measure(false);
    }
    if (this.commands !== null || snapshot.paused) {
      // A player chooses each discrete command from the frame shown: a
      // playback buffer behind the authority would land every command a
      // step late. A paused court holds its latest frame.
      const age = Math.max(0, now - this.receivedAt);
      const tick =
        snapshot.tick +
        (snapshot.paused
          ? 0
          : (age * this.options.simulation.timing.tickRate) / 1000);
      this.presentationTick = Math.max(
        this.presentationTick,
        Math.min(snapshot.tick, tick)
      );
    } else
      this.presentationTick = Math.max(
        this.presentationTick,
        this.playback.sample(now)
      );
    let state = this.interpolation.sample(this.presentationTick);
    const merge = this.options.simulation.presentation?.mergeLocal;
    if (merge !== undefined && !snapshot.paused)
      for (const [side, control] of this.controls) {
        state = merge(state, this.local(control, side), side);
        const changed = this.changedAt.get(side);
        if (changed !== undefined) {
          if (this.inputRenderMs.length < 256)
            this.inputRenderMs.push(now - changed);
          this.changedAt.delete(side);
        }
      }
    return state;
  }

  /**
   * The local entity this frame: from where the latest input's tick starts
   * it, carried on by that input for the time since it left (at most one
   * refresh). A person's own paddle so moves every frame at its own speed,
   * from the frame after they press, and stops where they let go.
   */
  private local(control: LocalControl, side: GameSide) {
    const predicted = control.prediction.state();
    const predict = this.options.simulation.presentation?.predict;
    const held = control.submitted;
    if (
      predict === undefined ||
      held === undefined ||
      control.prediction.pendingCount() === 0
    )
      return predicted;
    const timing = this.options.simulation.timing;
    const since = Math.max(
      0,
      Math.min(
        1000 / Math.min(30, timing.tickRate),
        this.options.clock.now() - control.submittedAt
      )
    );
    return predict(control.base ?? predicted, side, held, since);
  }

  isPaused(): boolean {
    return this.latest?.paused ?? true;
  }
  isStale(): boolean {
    return (
      this.latest === null || this.options.clock.now() - this.receivedAt > 1000
    );
  }
  release(): void {
    this.held.clear();
    this.changed.clear();
  }
  reset(): void {
    this.forget();
    this.held.clear();
    this.heldOn = null;
  }

  /**
   * Re-reads the authority without letting go of a control the player still
   * holds: it resumes on the same court, and a new or paused court drops it.
   */
  resynchronize(): void {
    this.resynchronized++;
    if (this.latest !== null)
      this.heldOn = { epoch: this.latest.epoch, paused: this.latest.paused };
    this.forget();
  }

  private forget(): void {
    this.latest = null;
    this.commands?.reset({});
    this.controls.clear();
    this.changedAt.clear();
    this.inputTiming.clear();
    this.interpolation.reset();
    this.playback.reset();
    this.presentationTick = -Infinity;
  }

  private drainInputRender(): readonly number[] {
    if (this.inputRenderMs.length === 0) return [];
    const drained = this.inputRenderMs;
    this.inputRenderMs = [];
    return drained;
  }

  private measure(
    reconciled: boolean,
    acknowledgmentMs: readonly number[] = [],
    predictionErrors: readonly number[] = [],
    arrivalIntervalMs: number | null = null
  ): void {
    const now = this.options.clock.now();
    this.options.measure({
      snapshotAgeMs: Math.max(0, now - this.receivedAt),
      presentationDelayMs:
        this.commands === null ? this.playback.delayMs(now) : null,
      arrivalIntervalMs,
      playbackSnaps: this.playback.snaps(),
      resyncs: this.resynchronized,
      inputRenderMs: this.drainInputRender(),
      pendingInputs:
        (this.commands?.outstanding() ?? 0) +
        [...this.controls.values()].reduce(
          (count, control) => count + control.prediction.pendingCount(),
          0
        ),
      reconciled,
      acknowledgmentMs,
      predictionErrors,
    });
  }
}
