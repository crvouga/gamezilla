import type {
  SimulationInput,
  SimulationInputResult,
  SimulationOptions,
  SimulationSnapshot,
  SimulationStep,
} from '@pkgs/turn-game-shared-ts/simulation';
import {
  assertSimulationOptions,
  simulationInteger,
} from '@pkgs/turn-game-shared-ts/simulation';
import { createSeededRng } from '@pkgs/uuid-shared-ts/seeded-rng';
import { SimulationFailure } from './simulation-failure';
import { SimulationInputs } from './simulation-inputs';

/**
 * Fixed logical time, with no device, transport or renderer dependency.
 * Steps must treat state and inputs as immutable. Floating-point mechanics are
 * reproducible within the supported JS runtime; cross-runtime bitwise equality
 * is not promised. Integer/fixed-point game rules can make a stronger claim.
 */
export class FixedStepSimulation<S, I> {
  private readonly inputs: SimulationInputs<I>;
  private readonly random;
  private state: S;
  private tick = 0;
  private fractionalTicks = 0;
  private paused = false;
  readonly options: SimulationOptions;

  constructor(
    initial: S,
    private readonly step: SimulationStep<S, I>,
    options: SimulationOptions
  ) {
    assertSimulationOptions(options);
    this.options = Object.freeze({ ...options });
    this.state = initial;
    this.inputs = new SimulationInputs(this.options);
    this.random = createSeededRng(options.seed);
  }

  enqueue(input: SimulationInput<I>): SimulationInputResult {
    return this.inputs.add(input, this.tick);
  }

  snapshot(): SimulationSnapshot<S> {
    return {
      tick: this.tick,
      state: this.state,
      acknowledged: this.inputs.acknowledgments(),
    };
  }

  /** Direct tick advancement is useful for deterministic replay, never a wall clock. */
  advanceTicks(count: number): void {
    if (!simulationInteger(count, 0) || count > this.options.maxCatchUpTicks)
      throw new Error('simulation tick count exceeds the catch-up bound');
    if (this.paused) return;
    for (let index = 0; index < count; index++) this.advanceOne();
  }

  private advanceOne(): void {
    const tick = this.tick + 1;
    if (!Number.isSafeInteger(tick))
      throw new Error('simulation tick overflow');
    const deltaMs = 1000 / this.options.tickRate;
    const inputs = this.inputs.at(tick);
    let state: S;
    try {
      state = this.step(this.state, inputs, {
        tick,
        deltaMs,
        elapsedMs: tick * deltaMs,
        random: this.random.fork(String(tick)).random,
      });
    } catch (error) {
      throw new SimulationFailure(
        { options: this.options, before: this.snapshot(), inputs },
        error
      );
    }
    this.inputs.commit(tick, inputs);
    this.state = state;
    this.tick = tick;
  }

  /** Excess whole ticks are deliberately dropped; a stalled host cannot spiral. */
  advance(elapsedMs: number): {
    readonly advanced: number;
    readonly dropped: number;
  } {
    if (!Number.isFinite(elapsedMs) || elapsedMs < 0)
      throw new Error('simulation elapsed time must be finite and nonnegative');
    if (this.paused) return { advanced: 0, dropped: 0 };
    const due =
      this.fractionalTicks + (elapsedMs * this.options.tickRate) / 1000;
    if (!Number.isSafeInteger(Math.floor(due)))
      throw new Error('simulation elapsed time overflow');
    // Accommodate accumulation error at the exact mathematical tick boundary.
    const whole = Math.floor(due + 1e-9);
    this.fractionalTicks = Math.max(0, due - whole);
    const advanced = Math.min(whole, this.options.maxCatchUpTicks);
    this.advanceTicks(advanced);
    return { advanced, dropped: whole - advanced };
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.fractionalTicks = 0;
  }

  /** A discrete command changes mechanics without rewinding time or dropping queued inputs. */
  rebase(state: S): void {
    this.state = state;
  }

  /** Reconnect/checkpoint restore discards every input from the old connection. */
  restore(snapshot: SimulationSnapshot<S>): void {
    if (!simulationInteger(snapshot.tick, 0))
      throw new Error('invalid simulation tick');
    this.inputs.reset(snapshot.acknowledged);
    this.state = snapshot.state;
    this.tick = snapshot.tick;
    this.fractionalTicks = 0;
  }
}
