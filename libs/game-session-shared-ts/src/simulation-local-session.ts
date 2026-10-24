import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import { selectCustomSimulation } from './simulation-custom-selection';
import { SessionSimulation } from './simulation-session-runtime';
import { CheckpointLocalSimulation } from './simulation-session-state';
import { simulationFailed, simulationMeasures } from './simulation-telemetry';

export type LocalSimulationRoom = {
  readonly dispatch: (message: Message) => string | null;
  readonly getSnapshot: () => RoomState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly flushIo: () => Promise<void>;
};

/** Offline execution uses the same controller and the existing durable local-choice queue. */
export class LocalSimulationSession {
  private readonly session: SessionSimulation;
  private readonly unsubscribe: () => void;
  private readonly listeners = new Set<(message: Message) => void>();
  private chain: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor(
    private readonly options: {
      readonly room: LocalSimulationRoom;
      readonly owner: string;
      readonly rules: TurnGames;
      readonly clock: Clock;
      readonly timers: Timers;
      readonly createId: CreateId;
      readonly onError: (error: unknown) => void;
    }
  ) {
    this.session = new SessionSimulation(
      {
        clock: options.clock,
        timers: options.timers,
        publish: (message) => {
          for (const listener of this.listeners) listener(message);
        },
        commit: (_id, message) =>
          this.enqueue(async () => {
            if (options.room.dispatch(message) === null)
              throw new Error(
                'local game state could not be saved; reopen the game to try again'
              );
            await options.room.flushIo();
          }),
        enqueue: (work) => {
          this.enqueue(async () => {
            work();
          }).catch(options.onError);
        },
        onError: (error) => {
          simulationFailed('local');
          options.onError(error);
        },
      },
      {
        select: (state) =>
          selectCustomSimulation(state, options.rules, options.owner),
        checkpoint: (view, position, change) =>
          CheckpointLocalSimulation({
            gameId: view.id,
            position,
            ...change,
            at: Math.floor(options.clock.now()),
          }),
        measure: simulationMeasures('local'),
      }
    );
    this.session.presence([{ id: options.owner, clientId: 'local' }]);
    this.unsubscribe = options.room.subscribe(() =>
      this.session.update(options.room.getSnapshot())
    );
    this.session.update(options.room.getSnapshot());
  }

  subscribe(listener: (message: Message) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  send(message: Message): string | null {
    if (this.disposed) return null;
    const id = this.options.createId();
    const error = this.session.receive(
      { id, ts: this.options.clock.now(), payload: message },
      this.options.owner
    );
    if (error !== null) this.options.onError(error);
    return error === null ? id : null;
  }

  private enqueue(work: () => Promise<void>): Promise<void> {
    const run = this.chain.then(() => (this.disposed ? undefined : work()));
    this.chain = run.then(
      () => {},
      () => {}
    );
    return run;
  }

  async flush(): Promise<void> {
    let chain: Promise<void>;
    do {
      chain = this.chain;
      await chain;
    } while (chain !== this.chain);
  }

  dispose(): void {
    this.disposed = true;
    this.unsubscribe();
    this.session.dispose();
    this.listeners.clear();
  }
}
