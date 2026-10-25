import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomCommand, RoomError } from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import type {
  SimulationInputPolicy,
  SimulationRounds,
} from '@pkgs/turn-game-shared-ts/game-simulation';
import type {
  SimulationCodec,
  SimulationInput,
} from '@pkgs/turn-game-shared-ts/simulation';
import {
  driveSimulation,
  type SimulationDriverPorts,
} from './simulation-driver';
import type { FixedStepSimulation } from './simulation-engine';
import { SimulationInputProcessing } from './simulation-input-processing';
import {
  RequestSimulationSnapshot,
  SimulationStateChanged,
  SubmitSimulationInput,
} from './simulation-messages';

export type SimulationAuthorityRules<S, I> = {
  readonly epoch: string;
  /** Stable game seats mapped to the person controlling them; bots have no human identity. */
  readonly controllers: ReadonlyMap<string, string>;
  readonly codec: SimulationCodec<S>;
  readonly parseInput: (value: unknown) => I | null;
  /** Held controls by default; discrete commands are scheduled by arrival. */
  readonly input?: SimulationInputPolicy;
  readonly rounds?: SimulationRounds<S, I>;
};

export type SimulationAuthorityPorts<S> = Omit<
  SimulationDriverPorts<S>,
  'publish'
> & {
  /** The existing RoomServer.publishSignal, never another transport. */
  readonly publish: (message: Message, audience?: readonly string[]) => void;
  /** Authority receipt to successful application; excludes transport and snapshot wait. */
  readonly inputProcessed: (milliseconds: readonly number[]) => void;
  /** A refused control, by bounded reason; never a per-player label. */
  readonly inputRefused?: (reason: SimulationInputRefusal) => void;
};

export type SimulationInputRefusal =
  | 'epoch'
  | 'owner'
  | 'paused'
  | 'invalid'
  | 'round'
  | 'late'
  | 'future'
  | 'full';

/**
 * Execution adapter hosted by an existing game session's authoritative room.
 * Session creation, membership, results and history stay with that session.
 * A paused/closed execution never accepts movement left over from a connection.
 */
export class SimulationAuthority<S, I> {
  private readonly driver;
  private revision = 0;
  private paused = false;
  private disposed = false;
  private epoch: string;
  private readonly controllers: ReadonlyMap<string, string>;
  private readonly inputProcessing: SimulationInputProcessing;
  private readonly unsubscribeTicks: () => void;

  constructor(
    private readonly simulation: FixedStepSimulation<S, I>,
    private readonly rules: SimulationAuthorityRules<S, I>,
    private readonly ports: SimulationAuthorityPorts<S>
  ) {
    if (rules.epoch.length === 0 || rules.epoch.length > 256)
      throw new Error('invalid simulation epoch');
    this.controllers = new Map(rules.controllers);
    this.epoch = rules.epoch;
    this.inputProcessing = new SimulationInputProcessing(
      simulation.options.maxQueuedInputs
    );
    this.unsubscribeTicks = simulation.subscribeTicks((tick, inputs) => {
      const samples = this.inputProcessing.applied(
        tick,
        inputs,
        ports.clock.now()
      );
      if (samples.length > 0) ports.inputProcessed(samples);
    });
    this.driver = driveSimulation(simulation, {
      ...ports,
      publish: () => this.publish(),
      onError: (error) => {
        this.disposed = true;
        this.inputProcessing.clear();
        this.unsubscribeTicks();
        ports.onError(error);
      },
    });
  }

  /** Called by room only after its ordinary permission and session-lifetime gates. */
  receive(command: RoomCommand, identity: string): RoomError | null {
    const receivedAt = this.ports.clock.now();
    if (this.disposed) return this.refuse('this game is no longer running');
    if (RequestSimulationSnapshot.is(command.payload)) {
      this.publish([identity]);
      return null;
    }
    if (!SubmitSimulationInput.is(command.payload))
      return {
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: 'unknown simulation input',
      };
    const input = command.payload.payload;
    if (input.epoch !== this.epoch)
      return this.refused('epoch', 'this input belongs to an earlier game');
    if (this.controllers.get(input.playerId) !== identity)
      return this.refused('owner', 'only the player controls this side', {
        type: ROOM_ERROR_TYPE.unauthorized,
        reason: 'only the player controls this side',
      });
    if (this.paused) return this.refused('paused', 'this game is paused');
    const value = this.rules.parseInput(input.value);
    if (value === null)
      return this.refused('invalid', 'invalid game control', {
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: 'invalid game control',
      });
    if (this.simulation.seen(input.playerId, input.sequence)) return null;
    const rounds = this.rules.rounds;
    if (
      rounds !== undefined &&
      rounds.ofInput(value) !== rounds.current(this.simulation.current())
    )
      return this.refused('round', 'this input belongs to an earlier round');
    const scheduled = this.schedule({ ...input, value });
    if ('refusal' in scheduled) return scheduled.refusal;
    const result = this.simulation.enqueue(scheduled);
    if (result.accepted) this.inputProcessing.record(scheduled, receivedAt);
    if (result.accepted || result.reason === 'duplicate') return null;
    if (result.reason === 'full')
      return this.refused('full', 'too many controls', {
        type: ROOM_ERROR_TYPE.rateLimited,
      });
    if (result.reason === 'invalid')
      return this.refused('invalid', 'invalid game control', {
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: 'invalid game control',
      });
    return this.refused(result.reason, `input ${result.reason}`);
  }

  /**
   * Held controls keep their requested tick inside the engine's lead window.
   * A command's tick is only its basis: it applies at the next uncommitted
   * tick in arrival order, so no device chooses when its command takes effect.
   */
  private schedule(
    input: SimulationInput<I>
  ): SimulationInput<I> | { readonly refusal: RoomError } {
    const policy = this.rules.input;
    const committed = this.simulation.committedTick();
    if (policy?.mode !== 'commands') return this.held(input, committed);
    if (input.tick > committed)
      return { refusal: this.refused('future', 'input future') };
    if (committed - input.tick > policy.maxAgeTicks)
      return { refusal: this.refused('late', 'input late') };
    if (
      this.simulation.pendingFor(input.playerId) >= policy.maxPendingPerPlayer
    )
      return {
        refusal: this.refused('full', 'too many controls', {
          type: ROOM_ERROR_TYPE.rateLimited,
        }),
      };
    return { ...input, tick: committed + 1 };
  }

  /**
   * A held control for a tick already committed outran its device's lead
   * by the network's round trip: what the player holds now applies at the
   * next tick, unless it is older than the lead window allows.
   */
  private held(
    input: SimulationInput<I>,
    committed: number
  ): SimulationInput<I> | { readonly refusal: RoomError } {
    if (input.tick > committed) return input;
    if (committed - input.tick >= this.simulation.options.maxInputLeadTicks)
      return { refusal: this.refused('late', 'input late') };
    return { ...input, tick: committed + 1 };
  }

  publish(audience?: readonly string[]): void {
    if (this.disposed) return;
    const snapshot = this.simulation.snapshot();
    this.revision += 1;
    this.ports.publish(
      SimulationStateChanged({
        version: 1,
        epoch: this.epoch,
        revision: this.revision,
        tick: snapshot.tick,
        state: this.rules.codec.encode(snapshot.state),
        acknowledged: snapshot.acknowledged,
        paused: this.paused,
      }),
      audience
    );
  }

  /** The game session decides interruption policy; device visibility never calls this. */
  setPaused(paused: boolean): void {
    if (this.disposed || this.paused === paused) return;
    this.paused = paused;
    this.inputProcessing.clear();
    this.simulation.restore(this.simulation.snapshot());
    this.simulation.setPaused(paused);
    this.driver.resetElapsed();
    if (paused) this.driver.suspend();
    else this.driver.resume();
    this.publish();
  }

  dispose(): void {
    this.disposed = true;
    this.inputProcessing.clear();
    this.unsubscribeTicks();
    this.driver.stop();
  }

  /** A resumed connection learns a fresh control fence; delayed old controls cannot reappear. */
  resetInputEpoch(epoch: string): void {
    if (epoch.length === 0 || epoch.length > 256)
      throw new Error('invalid simulation input epoch');
    this.epoch = epoch;
    this.inputProcessing.clear();
    this.simulation.restore(this.simulation.snapshot());
  }

  private refuse(reason: string): RoomError {
    return { type: ROOM_ERROR_TYPE.conflict, reason };
  }

  private refused(
    kind: SimulationInputRefusal,
    reason: string,
    error: RoomError = this.refuse(reason)
  ): RoomError {
    this.ports.inputRefused?.(kind);
    return error;
  }
}
