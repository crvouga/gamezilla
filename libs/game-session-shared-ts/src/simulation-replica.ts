import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import { SimulationInputTiming } from './simulation-input-timing';
import { SnapshotInterpolation } from './simulation-interpolation';
import {
  type SimulationSnapshotPayload,
  SimulationStateChanged,
  SubmitSimulationInput,
} from './simulation-messages';
import { InputPrediction } from './simulation-prediction';

type Projection = { readonly value: unknown; readonly deltaMs: number };
type LocalControl = {
  prediction: InputPrediction<unknown, Projection>;
  value: unknown;
  tick: number;
};

/** Presentation-only replica: scores and remote entities always come from the room authority. */
export class SimulationReplica {
  private latest: SimulationSnapshotPayload | null = null;
  private receivedAt = 0;
  private lastSentAt = -Infinity;
  private measuredAt = -Infinity;
  private readonly inputTiming;
  private readonly interpolation;
  private readonly controls = new Map<GameSide, LocalControl>();
  private readonly held = new Map<GameSide, unknown>();

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
      }) => void;
    }
  ) {
    this.inputTiming = new SimulationInputTiming(
      Math.min(64, options.simulation.timing.maxQueuedInputs)
    );
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
      this.held.clear();
      this.interpolation.reset();
    }
    this.latest = snapshot;
    this.receivedAt = this.options.clock.now();
    this.interpolation.push({ tick: snapshot.tick, state });
    const acknowledgmentMs: number[] = [];
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
      if (
        !control.prediction.reconcile(progress) &&
        snapshot.tick > (previous?.tick ?? -1)
      )
        control.prediction.reset(progress);
    }
    this.measure(previous !== null, acknowledgmentMs);
    return true;
  }

  control(side: GameSide, input: unknown): boolean {
    const value = this.options.simulation.parseInput(input);
    if (value === null || this.latest === null || this.latest.paused)
      return false;
    this.held.set(side, value);
    return true;
  }

  /** Coalesces raw device events; periodic held input also bounds the game's input lease. */
  pump(): void {
    const snapshot = this.latest;
    const now = this.options.clock.now();
    const timing = this.options.simulation.timing;
    if (
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
        value,
        prediction: new InputPrediction<unknown, Projection>(
          {
            epoch: snapshot.epoch,
            tick: snapshot.tick,
            acknowledged: snapshot.acknowledged[side] ?? 0,
            state,
          },
          (previous, input) =>
            project?.(previous, side, input.value.value, input.value.deltaMs) ??
            previous,
          Math.min(64, this.options.simulation.timing.maxQueuedInputs)
        ),
      };
      this.controls.set(side, control);
    }
    if (tick <= control.tick) return;
    const deltaMs = Math.min(
      100,
      ((tick - Math.max(snapshot.tick, control.tick)) * 1000) /
        this.options.simulation.timing.tickRate
    );
    const input = control.prediction.submit({ value, deltaMs }, tick);
    if (input === null) return;
    control.tick = tick;
    control.value = value;
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
    const tick =
      snapshot.tick +
      (snapshot.paused ? 0 : (age * timing.tickRate) / 1000) -
      (2 * timing.tickRate) / timing.snapshotRate;
    let state = this.interpolation.sample(tick);
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
    this.latest = null;
    this.controls.clear();
    this.inputTiming.clear();
    this.held.clear();
    this.interpolation.reset();
  }

  private measure(
    reconciled: boolean,
    acknowledgmentMs: readonly number[] = []
  ): void {
    this.options.measure({
      snapshotAgeMs: Math.max(0, this.options.clock.now() - this.receivedAt),
      pendingInputs: [...this.controls.values()].reduce(
        (count, control) => count + control.prediction.pendingCount(),
        0
      ),
      reconciled,
      acknowledgmentMs,
    });
  }
}
