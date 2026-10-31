import type { Message } from '@pkgs/message-shared-ts/message';
import type {
  RoomRuntime,
  RoomRuntimePorts,
} from '@pkgs/room-root-shared-ts/runtime';
import type {
  RoomActor,
  RoomCommand,
  RoomError,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';
import type {
  BotDifficulty,
  GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import type { SimulationExecution } from '@pkgs/turn-game-shared-ts/simulation-execution';
import { SimulationAuthority } from './simulation-authority';
import { withSimulationBots } from './simulation-bots';
import { rebaseSimulationCommand } from './simulation-command-state';
import { FixedStepSimulation } from './simulation-engine';
import { SimulationFailure } from './simulation-failure';
import {
  RecoverSimulation,
  recoverSimulation,
  type SimulationRecovery,
} from './simulation-recovery';
import { publishRecoverableSimulation } from './simulation-recovery-publish';
import {
  continuesWhenAbsent,
  SimulationRetirement,
} from './simulation-retirement';
import { SIMULATION_DISCONNECT_MS } from './simulation-session-state';

export type SimulationSessionView = {
  readonly id: string;
  readonly active: boolean;
  readonly available: boolean;
  readonly position: string;
  readonly simulation: RegisteredSimulation;
  readonly controllers: ReadonlyMap<GameSide, string>;
  readonly bots: readonly {
    readonly side: GameSide;
    readonly difficulty: BotDifficulty;
  }[];
  readonly execution: SimulationExecution | undefined;
};
export type SimulationSessionBinding = {
  /** Every server or local authority saves its published court through its existing room store. */
  readonly persist: RoomRuntimePorts<Message>['checkpoint'];
  readonly project?: (
    state: RoomState,
    position: string,
    execution: SimulationExecution
  ) => RoomState;
  readonly select: (state: RoomState) => SimulationSessionView | null;
  readonly checkpoint: (
    view: SimulationSessionView,
    position: string,
    change: {
      readonly execution: SimulationExecution;
      readonly previousEpoch: string | null;
    }
  ) => Message;
  readonly measure: (sample: {
    durationMs: number;
    delayMs: number;
    droppedTicks: number;
  }) => void;
  readonly inputProcessed: (milliseconds: readonly number[]) => void;
};

/** Shared execution attached to an existing custom or matched session. */
export class SessionSimulation
  implements RoomRuntime<RoomState, Message, string>
{
  private view: SimulationSessionView | null = null;
  private recovery: SimulationRecovery | null = null;
  private engine: FixedStepSimulation<unknown, unknown> | null = null;
  private authority: SimulationAuthority<unknown, unknown> | null = null;
  private retirement: SimulationRetirement | null = null;
  private execution: SimulationExecution | null = null;
  private actors: readonly RoomActor[] = [];
  private pendingEpoch: string | null = null;
  private savedKey = '';
  private saving = false;
  private saveSequence = 0;
  private disposed = false;

  constructor(
    private readonly ports: Omit<RoomRuntimePorts<Message>, 'checkpoint'>,
    private readonly binding: SimulationSessionBinding
  ) {}

  recover(state: RoomState, payload: Message): Message | null {
    const view = this.binding.select(state);
    const saved = recoverSimulation(view, payload);
    return view === null || saved === null
      ? null
      : this.binding.checkpoint(view, saved.position, {
          execution: saved.execution,
          previousEpoch: saved.previousEpoch,
        });
  }

  update(state: RoomState): void {
    if (this.disposed) return;
    const view = this.binding.select(state);
    if (view === null || !view.active) {
      this.stop();
      this.view = view;
      return;
    }
    const previous = this.view;
    if (previous?.id !== view.id) this.stop();
    this.view = view;
    if (this.authority !== null) {
      try {
        if (
          previous !== null &&
          this.engine !== null &&
          rebaseSimulationCommand(this.engine, previous, view)
        )
          this.authority.publish();
      } catch (error) {
        this.fail(error);
        return;
      }
      this.presence(this.actors);
      return;
    }
    if (this.pendingEpoch !== null) {
      if (view.execution?.epoch === this.pendingEpoch)
        this.launch(view, view.execution);
      return;
    }
    this.begin(view);
  }

  private begin(view: SimulationSessionView): void {
    const generation = (view.execution?.generation ?? 0) + 1;
    const missing = this.missing(view);
    const decoded = view.simulation.codec.decode(view.position);
    if (decoded === null) throw new Error('invalid simulation checkpoint');
    const phase = view.simulation.phase?.(decoded) ?? 'running';
    const live = missing.length === 0 || continuesWhenAbsent(view.simulation);
    const execution: SimulationExecution = {
      epoch: `${view.id}:${generation}`,
      generation,
      inputGeneration: 0,
      tick: view.execution?.tick ?? 0,
      acknowledged: {},
      phase: live ? phase : 'paused',
      started:
        view.execution?.started === true || (live && phase === 'running'),
      missing,
      expiresAt: this.deadline(
        view,
        missing,
        view.execution?.expiresAt ?? null
      ),
    };
    this.pendingEpoch = execution.epoch;
    const command = this.binding.checkpoint(view, view.position, {
      execution,
      previousEpoch: view.execution?.epoch ?? null,
    });
    this.ports
      .commit(`${execution.epoch}:begin`, command)
      .catch((error: unknown) => this.fail(error, view.id));
  }

  private launch(
    view: SimulationSessionView,
    execution: SimulationExecution
  ): void {
    const definition = view.simulation;
    const decoded = definition.codec.decode(view.position);
    if (decoded === null) throw new Error('invalid simulation checkpoint');
    const initial = definition.resetInputs?.(decoded) ?? decoded;
    const retirement = continuesWhenAbsent(definition)
      ? new SimulationRetirement(definition)
      : null;
    const withBots = withSimulationBots(
      definition.step,
      view.bots.map((bot) => ({
        playerId: bot.side,
        input: (
          state: unknown,
          context: Parameters<typeof definition.step>[2]
        ) => {
          if (definition.bots === undefined)
            throw new Error('missing simulation bot inputs');
          return definition.bots.input(
            state,
            bot.side,
            bot.difficulty,
            context
          );
        },
      })),
      definition.parseInput
    );
    const step = retirement === null ? withBots : retirement.wrap(withBots);
    retirement?.absent(execution.missing, execution.tick);
    this.retirement = retirement;
    const engine = new FixedStepSimulation(initial, step, {
      ...definition.timing,
      seed: view.id,
    });
    engine.restore({
      state: initial,
      tick: execution.tick,
      acknowledged: execution.acknowledged,
    });
    this.engine = engine;
    this.execution = execution;
    this.pendingEpoch = null;
    this.savedKey = this.key();
    this.authority = new SimulationAuthority(
      engine,
      {
        epoch: this.inputEpoch(),
        controllers: view.controllers,
        codec: definition.codec,
        parseInput: definition.parseInput,
        ...(definition.input === undefined ? {} : { input: definition.input }),
        ...(definition.rounds === undefined
          ? {}
          : { rounds: definition.rounds }),
      },
      {
        clock: this.ports.clock,
        timers: this.ports.timers,
        enqueue: this.ports.enqueue,
        snapshotRate: definition.timing.snapshotRate,
        publish: (message, audience) => this.publish(message, audience),
        measure: this.binding.measure,
        inputProcessed: this.binding.inputProcessed,
        onError: (error) => this.fail(error),
      }
    );
    this.authority.setPaused(execution.phase === 'paused');
    this.presence(this.actors);
    this.authority.publish();
  }

  receive(command: RoomCommand, identity: string): RoomError | null {
    if (this.authority === null)
      return {
        type: ROOM_ERROR_TYPE.conflict,
        reason: 'the game is getting ready; try again shortly',
      };
    return this.authority.receive(command, identity);
  }

  project(state: RoomState): RoomState {
    if (
      this.binding.project === undefined ||
      this.engine === null ||
      this.execution === null ||
      this.view === null
    )
      return state;
    const snapshot = this.engine.snapshot();
    const phase = this.phase();
    return this.binding.project(
      state,
      this.view.simulation.codec.encode(snapshot.state),
      {
        ...this.execution,
        tick: snapshot.tick,
        acknowledged: snapshot.acknowledged,
        phase,
        started: this.execution.started || phase === 'running',
      }
    );
  }

  presence(actors: readonly RoomActor[]): void {
    this.actors = actors;
    const view = this.view;
    if (
      view === null ||
      this.authority === null ||
      this.execution === null ||
      this.engine === null
    )
      return;
    const missing = this.missing(view);
    if (missing.join(',') === this.execution.missing.join(',')) return;
    if (this.retirement !== null) {
      this.continueWithout(view, missing);
      return;
    }
    this.execution = {
      ...this.execution,
      inputGeneration: this.execution.inputGeneration + 1,
      missing,
      phase: missing.length === 0 ? 'running' : 'paused',
      expiresAt: this.deadline(view, missing, null),
    };
    const snapshot = this.engine.snapshot();
    this.engine.restore({
      ...snapshot,
      state: view.simulation.resetInputs?.(snapshot.state) ?? snapshot.state,
    });
    this.authority.resetInputEpoch(this.inputEpoch());
    this.authority.setPaused(missing.length !== 0);
    this.authority.publish();
  }

  /**
   * A continuing arena keeps running for everyone else: only the absent
   * seats' waiting inputs are fenced, present players keep their input epoch,
   * and absent seats retire after the grace period.
   */
  private continueWithout(
    view: SimulationSessionView,
    missing: readonly GameSide[]
  ): void {
    const engine = this.engine!;
    for (const side of missing)
      if (!this.execution!.missing.includes(side)) engine.discardInputs(side);
    this.retirement!.absent(missing, engine.committedTick());
    this.execution = {
      ...this.execution!,
      missing: [...missing],
      expiresAt: this.deadline(view, missing, null),
    };
    this.authority!.publish();
  }

  /**
   * The persisted absence deadline: any absence of a paused game, or the
   * absence of every controller of a continuing one.
   */
  private deadline(
    view: SimulationSessionView,
    missing: readonly GameSide[],
    previous: number | null
  ): number | null {
    const waits = continuesWhenAbsent(view.simulation)
      ? missing.length > 0 &&
        [...view.controllers.keys()].every((side) => missing.includes(side))
      : missing.length > 0;
    if (!waits) return null;
    return (
      previous ?? Math.floor(this.ports.clock.now()) + SIMULATION_DISCONNECT_MS
    );
  }

  private missing(view: SimulationSessionView): GameSide[] {
    if (!view.available)
      return [
        ...new Set([
          ...view.controllers.keys(),
          ...view.bots.map((bot) => bot.side),
        ]),
      ].sort();
    const present = new Set(this.actors.map((actor) => actor.id));
    return [...view.controllers]
      .filter(([, identity]) => !present.has(identity))
      .map(([side]) => side)
      .sort();
  }

  private phase(): SimulationExecution['phase'] {
    if (this.execution?.missing.length !== 0 && this.retirement === null)
      return 'paused';
    const state = this.engine!.snapshot().state;
    return (
      this.view!.simulation.phase?.(state) ??
      (this.view!.simulation.result(state) === null ? 'running' : 'completed')
    );
  }

  private key(): string {
    if (this.engine === null || this.execution === null || this.view === null)
      return '';
    return `${this.view.simulation.checkpointKey?.(this.engine.snapshot().state) ?? ''}:${this.phase()}:${this.execution.inputGeneration}:${this.execution.missing.join(',')}:${this.execution.expiresAt}`;
  }

  private inputEpoch(): string {
    return `${this.execution!.epoch}:${this.execution!.inputGeneration}`;
  }

  private publish(message: Message, audience?: readonly string[]): void {
    if (
      this.disposed ||
      this.view === null ||
      this.execution === null ||
      this.engine === null
    )
      return;
    if (this.saving) return;
    if (this.key() === this.savedKey) {
      const view = this.view;
      const epoch = this.execution.epoch;
      publishRecoverableSimulation({
        message,
        view,
        execution: this.execution,
        phase: this.phase(),
        persist: this.binding.persist,
        publish: (recovery) => {
          if (
            !this.disposed &&
            this.view?.id === view.id &&
            this.execution?.epoch === epoch
          ) {
            if (
              recoverSimulation(this.view, RecoverSimulation(recovery)) === null
            )
              return;
            this.recovery = recovery;
            this.ports.publish(message, audience);
          }
        },
        onError: (error) => this.fail(error, view.id),
      });
      return;
    }
    const view = this.view;
    const snapshot = this.engine.snapshot();
    const execution = {
      ...this.execution,
      phase: this.phase(),
      started: this.execution.started || this.phase() === 'running',
      tick: snapshot.tick,
      acknowledged: snapshot.acknowledged,
    };
    this.execution = execution;
    const key = this.key();
    const command = this.binding.checkpoint(
      view,
      view.simulation.codec.encode(snapshot.state),
      { execution, previousEpoch: execution.epoch }
    );
    this.saving = true;
    this.ports
      .commit(`${execution.epoch}:checkpoint:${++this.saveSequence}`, command)
      .then(
        () => {
          this.saving = false;
          this.savedKey = key;
          if (
            this.view?.id === view.id &&
            this.view.execution?.epoch === execution.epoch
          ) {
            this.authority?.publish();
          }
        },
        (error: unknown) => this.fail(error, view.id)
      );
  }

  dispose(): void {
    this.disposed = true;
    this.stop();
  }

  private stop(): void {
    this.authority?.dispose();
    this.authority = null;
    this.retirement = null;
    this.engine = null;
    this.recovery = null;
    this.execution = null;
    this.pendingEpoch = null;
    this.savedKey = '';
    this.saving = false;
  }

  private fail(error: unknown, gameId = this.view?.id): void {
    if (
      this.disposed ||
      this.view === null ||
      this.view.id !== gameId ||
      !this.view.active
    )
      return;
    const view = this.view;
    const recovered =
      this.recovery === null
        ? null
        : recoverSimulation(view, RecoverSimulation(this.recovery));
    const execution = recovered?.execution ?? view.execution;
    const position = recovered?.position ?? view.position;
    this.stop();
    this.ports.onError(
      error instanceof SimulationFailure
        ? error.withSession({ position: view.position, bots: view.bots })
        : error
    );
    if (execution === undefined) return;
    const abandoned: SimulationExecution = {
      ...execution,
      phase: 'abandoned',
      missing: [],
      expiresAt: null,
    };
    const command = this.binding.checkpoint(view, position, {
      execution: abandoned,
      previousEpoch: execution.epoch,
    });
    this.ports
      .commit(`${execution.epoch}:failed`, command)
      .catch((failure: unknown) => this.ports.onError(failure));
  }
}
