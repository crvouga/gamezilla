import type {
  RoomLivePorts,
  RoomLiveSession,
} from '@pkgs/room-root-shared-ts/live';
import type { RoomServerConfig } from '@pkgs/room-root-shared-ts/room-server-types';
import type { RoomStorage } from '@pkgs/room-root-shared-ts/server-core-storage';
import type {
  RoomActor,
  RoomCommand,
  RoomCommandPayload,
  RoomError,
  RoomEvent,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import { ROOM_ERROR_TYPE } from '@pkgs/room-root-shared-ts/types';

/** The trusted live port shares the exact serial chain and durable command verdict. */
export function roomLivePorts<C extends RoomCommandPayload>(args: {
  readonly storage: RoomStorage;
  readonly topic: string;
  readonly publish: RoomLivePorts<C>['publish'];
  readonly enqueue: <T>(work: () => Promise<T>) => Promise<T>;
  readonly tip: () => number;
  readonly acceptsCheckpoint: (payload: RoomCommandPayload) => boolean;
  readonly inject: (id: string, payload: C) => Promise<void>;
  readonly onError: (error: unknown) => void;
}): Pick<RoomLivePorts<C>, 'publish' | 'commit' | 'enqueue' | 'checkpoint'> {
  return {
    checkpoint: (payload) => {
      const atSeq = args.tip();
      return args.enqueue(async () => {
        if (args.tip() !== atSeq || !args.acceptsCheckpoint(payload))
          return false;
        return args.storage.replaceLiveCheckpoint(args.topic, atSeq, payload);
      });
    },
    publish: args.publish,
    commit: (id, payload) =>
      args.enqueue(async () => {
        await args.inject(id, payload);
        const outcome = await args.storage.getDedupOutcome(args.topic, id);
        if (outcome?.kind === 'rejected')
          throw new Error(
            'reason' in outcome.error
              ? outcome.error.reason
              : 'live game checkpoint was refused'
          );
      }),
    enqueue: (work) => {
      args
        .enqueue(async () => {
          work();
        })
        .catch(args.onError);
    },
  };
}

/** Lazy owned live execution; an ordinary turn/puzzle room allocates no simulation timer. */
export class RoomServerLive<
  S extends RoomState,
  C extends RoomCommandPayload,
  E extends RoomEvent,
  Identity,
> {
  private session: RoomLiveSession<S, Identity, C> | null = null;
  private ready = false;
  private disposed = false;
  private actors: readonly RoomActor[] = [];

  constructor(
    private readonly config: RoomServerConfig<S, C, E, Identity>,
    private readonly ports: Pick<
      RoomLivePorts<C>,
      'publish' | 'commit' | 'enqueue' | 'checkpoint'
    >
  ) {}

  private createSession(): void {
    if (this.disposed) return;
    const create = this.config.module.createLive;
    if (this.session === null && create !== undefined) {
      if (this.config.signalHandler !== undefined)
        throw new Error('one live execution owns the room signal handler');
      const config = this.config;
      this.session = create({
        ...this.ports,
        clock: config.clock,
        // Installing a live capability does not start it for another game.
        get timers() {
          if (config.timers === undefined)
            throw new Error('live room execution requires injected timers');
          return config.timers;
        },
        onError: (error) => this.report(error),
      });
      this.session.presence(this.actors);
    }
  }

  recover(state: S, payload: RoomCommandPayload): C | null {
    this.createSession();
    return this.session?.recover?.(state, payload) ?? null;
  }

  reset(): void {
    this.session?.dispose();
    this.session = null;
    this.ready = false;
  }

  start(state: S): void {
    this.ready = true;
    this.update(state);
  }

  update(state: S): void {
    if (!this.ready || this.disposed) return;
    this.createSession();
    this.session?.update(state);
  }

  receive(
    command: RoomCommand,
    identity: Identity,
    actor: RoomActor
  ): Promise<RoomError | null> | RoomError | null {
    if (this.session !== null)
      return this.session.receive(command, identity, actor);
    if (this.config.signalHandler === undefined)
      return {
        type: ROOM_ERROR_TYPE.invalidCommand,
        reason: 'this room does not accept signals',
      };
    return this.config.signalHandler(command, identity, actor);
  }

  commandState(state: S): S {
    return this.session?.project?.(state) ?? state;
  }

  presence(actors: readonly RoomActor[]): void {
    this.actors = actors;
    this.session?.presence(actors);
  }

  dispose(): void {
    this.disposed = true;
    this.session?.dispose();
    this.session = null;
  }

  report(error: unknown): void {
    if (this.config.onError === undefined) throw error;
    this.config.onError(error);
  }
}
