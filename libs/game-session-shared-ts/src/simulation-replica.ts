import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  type RegisteredSimulation,
  simulationInputPolicy,
} from '@pkgs/turn-game-shared-ts/game-simulation';
import { SimulationCommandOutbox } from './simulation-command-outbox';
import { SimulationInputTiming } from './simulation-input-timing';
import { SnapshotInterpolation } from './simulation-interpolation';
import {
  type SimulationSnapshotPayload,
  SimulationStateChanged,
  SubmitSimulationInput,
} from './simulation-messages';
import { InputPrediction } from './simulation-prediction';

type LocalControl = {
  prediction: InputPrediction<unknown, unknown>;
  tick: number;
};

/** Presentation-only replica: scores and remote entities always come from the room authority. */
export class SimulationReplica {
  private latest: SimulationSnapshotPayload | null = null;
  private receivedAt = 0;
  private lastSentAt = -Infinity;
  private measuredAt = -Infinity;
  private presentationTick = -Infinity;
  private readonly inputTiming;
  private readonly interpolation;
  private readonly controls = new Map<GameSide, LocalControl>();
  private readonly held = new Map<GameSide, unknown>();
  /** The court a held control was chosen on, kept while a refresh re-reads it. */
  private heldOn: { readonly epoch: string; readonly paused: boolean } | null =
    null;
  private readonly commands: SimulationCommandOutbox | null;

  constructor(
    private readonly options: {
      readonly simulation: RegisteredSimulation;
      readonly clock: Clock;
      readonly send: (message: Message) => string | null;
      readonly measure: (sample: {
        snapshotAgeMs: number;
        pendingInputs: number;
        reconciled: boolean;
        acknowledgmentMs: readonly number[];
        predictionErrors: readonly number[];
      }) => void;
    }
  ) {
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
      this.presentationTick = -Infinity;
    }
    this.latest = snapshot;
    this.heldOn = null;
    this.commands?.acknowledge(
      snapshot.acknowledged,
      this.options.simulation.rounds?.current(state)
    );
    this.receivedAt = this.options.clock.now();
    this.interpolation.push({ tick: snapshot.tick, state });
    const measures = this.reconcile(snapshot, state, previous?.tick ?? -1);
    this.measure(
      previous !== null,
      measures.acknowledgmentMs,
      measures.predictionErrors
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
    this.held.set(side, value);
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

  /** Coalesces raw device events; periodic held input also bounds the game's input lease. */
  pump(): void {
    const snapshot = this.latest;
    const now = this.options.clock.now();
    const timing = this.options.simulation.timing;
    if (
      this.commands !== null ||
      snapshot === null ||
      snapshot.paused ||
      now - this.receivedAt > 1000 ||
      now - this.lastSentAt < 1000 / Math.min(30, timing.tickRate)
    )
      return;
    this.lastSentAt = now;
    const tick =
      snapshot.tick +
      Math.ceil((Math.max(0, now - this.receivedAt) * timing.tickRate) / 1000) +
      3;
    if (tick - snapshot.tick > timing.maxInputLeadTicks) return;
    for (const [side, value] of this.held) this.submit(side, value, tick);
  }

  private submit(side: GameSide, value: unknown, tick: number): void {
    const snapshot = this.latest!;
    let control = this.controls.get(side);
    if (control === undefined) {
      const project = this.options.simulation.presentation?.predict;
      const state = this.options.simulation.codec.decode(snapshot.state)!;
      control = {
        tick: snapshot.tick,
        prediction: new InputPrediction<unknown, unknown>(
          {
            epoch: snapshot.epoch,
            tick: snapshot.tick,
            acknowledged: snapshot.acknowledged[side] ?? 0,
            state,
          },
          (previous, input, fromTick) =>
            project?.(
              previous,
              side,
              input.value,
              Math.min(
                100,
                ((input.tick - fromTick) * 1000) /
                  this.options.simulation.timing.tickRate
              )
            ) ?? previous,
          Math.min(64, this.options.simulation.timing.maxQueuedInputs)
        ),
      };
      this.controls.set(side, control);
    }
    if (tick <= control.tick) return;
    const input = control.prediction.submit(value, tick);
    if (input === null) return;
    control.tick = tick;
    this.inputTiming.record(side, input.sequence, this.options.clock.now());
    const sent = this.options.send(
      SubmitSimulationInput({
        version: 1,
        epoch: snapshot.epoch,
        playerId: side,
        sequence: input.sequence,
        tick,
        value,
      })
    );
    if (sent === null) this.reset();
  }

  sample(): unknown | null {
    const snapshot = this.latest;
    if (snapshot === null) return null;
    if (this.options.clock.now() - this.measuredAt >= 1000) {
      this.measuredAt = this.options.clock.now();
      this.measure(false);
    }
    const age = Math.max(0, this.options.clock.now() - this.receivedAt);
    const timing = this.options.simulation.timing;
    // A player chooses each discrete command from the frame shown: a playback
    // buffer behind the authority would land every command a step late.
    const buffer =
      this.commands === null ? (2 * timing.tickRate) / timing.snapshotRate : 0;
    const tick =
      snapshot.tick +
      (snapshot.paused ? 0 : (age * timing.tickRate) / 1000) -
      buffer;
    // Packet arrival changes snapshot age, but cannot rewind the playback clock.
    // Holding at the latest frame must not reserve time beyond received authority.
    this.presentationTick = Math.max(
      this.presentationTick,
      Math.min(snapshot.tick, tick)
    );
    let state = this.interpolation.sample(this.presentationTick);
    const merge = this.options.simulation.presentation?.mergeLocal;
    if (merge !== undefined && !snapshot.paused)
      for (const [side, control] of this.controls)
        state = merge(state, control.prediction.state(), side);
    return state;
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
    if (this.latest !== null)
      this.heldOn = { epoch: this.latest.epoch, paused: this.latest.paused };
    this.forget();
  }

  private forget(): void {
    this.latest = null;
    this.commands?.reset({});
    this.controls.clear();
    this.inputTiming.clear();
    this.interpolation.reset();
    this.presentationTick = -Infinity;
  }

  private measure(
    reconciled: boolean,
    acknowledgmentMs: readonly number[] = [],
    predictionErrors: readonly number[] = []
  ): void {
    this.options.measure({
      snapshotAgeMs: Math.max(0, this.options.clock.now() - this.receivedAt),
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
