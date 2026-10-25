import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomLiveCheckpoint } from '@pkgs/room-root-shared-ts/live-checkpoint';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { CustomGameChoice } from './custom-game-choice';
import { CustomGamesAttr } from './custom-game-state';
import {
  projectCustomSimulation,
  selectCustomSimulation,
} from './simulation-custom-selection';
import {
  checkpointLocalProgress,
  chooseLocalSimulation,
  dispatchLocalSimulation,
} from './simulation-local-choice';
import { RecoverSimulation } from './simulation-recovery';
import { SessionSimulation } from './simulation-session-runtime';
import { CheckpointLocalSimulation } from './simulation-session-state';
import {
  simulationFailed,
  simulationInputProcessingMeasures,
  simulationMeasures,
} from './simulation-telemetry';

export type LocalSimulationRoom = {
  readonly dispatch: (message: Message) => string | null;
  readonly getSnapshot: () => RoomState;
  readonly subscribe: (listener: () => void) => () => void;
  readonly flushIo: () => Promise<void>;
  readonly loadLiveCheckpoint: () => Promise<RoomLiveCheckpoint | null>;
  readonly saveLiveCheckpoint: (message: Message) => Promise<boolean>;
};

/** Offline execution uses the shared controller, local-choice queue and bounded live checkpoint. */
export class LocalSimulationSession {
  private readonly session: SessionSimulation;
  private readonly unsubscribe: () => void;
  private readonly listeners = new Set<(message: Message) => void>();
  private chain: Promise<void> = Promise.resolve();
  private disposed = false;
  private ready = false;
  private receiving = false;
  private elsewhere = false;

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
          this.receiving = true;
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
          this.receiving = false;
          simulationFailed('local');
          options.onError(error);
        },
      },
      {
        persist: (message) => this.persist(message),
        project: projectCustomSimulation,
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
        inputProcessed: simulationInputProcessingMeasures('local'),
      }
    );
    this.session.presence([{ id: options.owner, clientId: 'local' }]);
    this.unsubscribe = options.room.subscribe(() => {
      if (this.ready) this.session.update(options.room.getSnapshot());
    });
    this.enqueue(() => this.restore()).catch(options.onError);
  }

  private async restore(): Promise<void> {
    const room = this.options.room;
    const saved = await room.loadLiveCheckpoint();
    if (this.disposed) return;
    // A game already under way runs on the device that saved it: another
    // device of the same person shows it, but never runs it a second time.
    const current = CustomGamesAttr.from(room.getSnapshot()).current;
    if (
      current?.execution !== undefined &&
      !(
        saved !== null &&
        RecoverSimulation.is(saved.payload) &&
        saved.payload.payload.checkpoint.gameId === current.id
      )
    ) {
      this.elsewhere = true;
      return;
    }
    const command =
      saved === null
        ? null
        : this.session.recover(room.getSnapshot(), saved.payload);
    if (command !== null) {
      dispatchLocalSimulation(room, command);
      await room.flushIo();
    }
    this.ready = true;
    this.session.update(room.getSnapshot());
  }

  /** A slow store holds the next wake behind one write instead of accumulating tick frames. */
  private persist(message: Message): Promise<boolean> {
    let saved = false;
    return this.enqueue(async () => {
      saved = await this.options.room.saveLiveCheckpoint(message);
    }).then(() => saved);
  }

  subscribe(listener: (message: Message) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  isReady(): boolean {
    return this.receiving && !this.disposed;
  }

  /** Whether this game runs on another device of its owner, not this one. */
  runsElsewhere(): boolean {
    return this.elsewhere;
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

  choose(choice: CustomGameChoice): Promise<void> {
    if (this.disposed)
      return Promise.reject(
        new Error('the game closed; reopen it to try again')
      );
    return this.enqueue(async () => {
      chooseLocalSimulation({
        room: this.options.room,
        choice,
        projected: this.session.project(this.options.room.getSnapshot()),
        clock: this.options.clock,
      });
      await this.options.room.flushIo();
    });
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
      await this.options.room.flushIo();
    } while (chain !== this.chain);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unsubscribe();
    try {
      checkpointLocalProgress({
        room: this.options.room,
        projected: this.session.project(this.options.room.getSnapshot()),
        clock: this.options.clock,
      });
    } catch (error) {
      this.options.onError(error);
    }
    this.session.dispose();
    this.listeners.clear();
  }
}
