import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomRuntimePorts } from '@pkgs/room-root-shared-ts/runtime';
import {
  ROOM_ERROR_TYPE,
  type RoomActor,
  type RoomCommand,
  type RoomError,
  type RoomState,
} from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import type { RegisteredSimulation } from '@pkgs/turn-game-shared-ts/game-simulation';
import { soloCustomGame } from './custom-game-local';
import { type CustomGame, CustomGamesAttr } from './custom-game-state';
import { simulationCommandKey } from './simulation-command-state';
import {
  RequestSimulationSnapshot,
  type SimulationSnapshotPayload,
  SimulationStateChanged,
} from './simulation-messages';

/** One current local court, forwarded by its creator through this existing room. */
export class LocalSimulationRelay {
  private game: CustomGame | null = null;
  private simulation: RegisteredSimulation | undefined;
  private latest: SimulationSnapshotPayload | null = null;
  private source: string | null = null;
  private sourceRevision = 0;
  private revision = 0;
  private actors: readonly RoomActor[] = [];

  constructor(
    private readonly ports: Pick<RoomRuntimePorts<Message>, 'publish'>,
    private readonly rules: TurnGames
  ) {}

  get active(): boolean {
    return this.game !== null;
  }

  update(state: RoomState): void {
    const current = CustomGamesAttr.from(state).current;
    const simulation =
      current === null
        ? undefined
        : this.rules.simulation(this.rules.forPosition(current.fen).id);
    const next =
      current?.status === 'active' &&
      simulation !== undefined &&
      soloCustomGame(current, this.rules)
        ? current
        : null;
    if (
      this.game?.id !== next?.id ||
      this.game?.execution?.epoch !== next?.execution?.epoch ||
      this.game?.execution?.inputGeneration !== next?.execution?.inputGeneration
    )
      this.dispose();
    this.game = next;
    this.simulation = simulation;
    if ((this.latest?.tick ?? 0) < (next?.execution?.tick ?? 0))
      this.latest = null;
  }

  receive(
    command: RoomCommand,
    identity: string,
    actor: RoomActor
  ): RoomError | null {
    const game = this.game;
    // The creator can publish while its first ordinary checkpoint is still queued.
    if (
      game?.execution === undefined &&
      identity === game?.creator &&
      SimulationStateChanged.is(command.payload)
    )
      return null;
    if (game?.execution === undefined)
      return this.refuse('the game is getting ready; try again shortly');
    if (RequestSimulationSnapshot.is(command.payload)) {
      this.publish(this.latest ?? this.checkpoint(), [identity]);
      if (this.present())
        this.ports.publish(RequestSimulationSnapshot({ version: 1 }), [
          game.creator,
        ]);
      return null;
    }
    if (
      identity !== game.creator ||
      !SimulationStateChanged.is(command.payload)
    )
      return {
        type: ROOM_ERROR_TYPE.unauthorized,
        reason: 'only the creator shares a game running on this device',
      };
    const next = command.payload.payload;
    if (!this.valid(next))
      return this.refuse('this court belongs to an earlier game');
    if (this.source !== null && this.source !== actor.clientId)
      return this.refuse('another device is sharing this local game');
    if (
      next.revision <= this.sourceRevision ||
      next.tick < (this.latest?.tick ?? 0)
    )
      return null;
    this.source = actor.clientId;
    this.sourceRevision = next.revision;
    this.latest = next;
    this.publish(next);
    return null;
  }

  presence(actors: readonly RoomActor[]): void {
    const before = this.present();
    this.actors = actors;
    if (this.source !== null && !this.present()) {
      this.source = null;
      this.sourceRevision = 0;
    }
    if (before !== this.present() && this.latest !== null)
      this.publish(this.latest);
  }

  dispose(): void {
    this.game = null;
    this.latest = null;
    this.source = null;
    this.sourceRevision = 0;
    this.revision = 0;
  }

  private present(): boolean {
    return this.actors.some(
      (actor) =>
        actor.id === this.game?.creator &&
        (this.source === null || actor.clientId === this.source)
    );
  }

  private valid(snapshot: SimulationSnapshotPayload): boolean {
    const game = this.game!;
    const execution = game.execution!;
    return (
      snapshot.epoch === `${execution.epoch}:${execution.inputGeneration}` &&
      snapshot.tick >= execution.tick &&
      this.rules.forPosition(game.fen).recognizes(snapshot.state) &&
      this.simulation?.codec.decode(snapshot.state) != null &&
      simulationCommandKey(this.simulation, snapshot.state) ===
        simulationCommandKey(this.simulation, game.fen)
    );
  }

  private checkpoint(): SimulationSnapshotPayload {
    const execution = this.game!.execution!;
    return {
      version: 1,
      epoch: `${execution.epoch}:${execution.inputGeneration}`,
      revision: 1,
      tick: execution.tick,
      state: this.game!.fen,
      acknowledged: execution.acknowledged,
      paused: execution.phase === 'paused',
    };
  }

  private publish(
    snapshot: SimulationSnapshotPayload,
    audience?: readonly string[]
  ): void {
    this.ports.publish(
      SimulationStateChanged({
        ...snapshot,
        revision: ++this.revision,
        paused: snapshot.paused || !this.present(),
      }),
      audience
    );
  }

  private refuse(reason: string): RoomError {
    return { type: ROOM_ERROR_TYPE.conflict, reason };
  }
}
