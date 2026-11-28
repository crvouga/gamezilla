import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { GameSessionChoice } from './game-session-choice';
import { ChangeLocalGameSession } from './game-session-commands';
import { GameSessionNoticeAttr } from './game-session-router';
import { GameSessionsAttr } from './game-session-state';
import type { LocalSimulationRoom } from './simulation-local-session';
import { CheckpointLocalSimulation } from './simulation-session-state';

export function dispatchLocalSimulation(
  room: LocalSimulationRoom,
  message: Message
): void {
  const id = room.dispatch(message);
  if (id === null)
    throw new Error('the game could not be saved; reopen it to try again');
  const notice = GameSessionNoticeAttr.from(room.getSnapshot());
  if (notice.commandId === id && notice.reason !== '')
    throw new Error(notice.reason);
}

/** A closing screen records its current pose once, through the same durable queue. */
export function checkpointLocalProgress(options: {
  readonly room: LocalSimulationRoom;
  readonly projected: RoomState;
  readonly clock: Clock;
}): void {
  const before = GameSessionsAttr.from(options.room.getSnapshot()).current;
  const current = GameSessionsAttr.from(options.projected).current;
  if (
    before?.status !== 'active' ||
    current?.execution === undefined ||
    current.id !== before.id ||
    (current.fen === before.fen &&
      current.execution.tick === before.execution?.tick &&
      current.execution.epoch === before.execution?.epoch)
  )
    return;
  dispatchLocalSimulation(
    options.room,
    CheckpointLocalSimulation({
      gameId: current.id,
      position: current.fen,
      execution: current.execution,
      previousEpoch: current.execution.epoch,
      at: Math.floor(options.clock.now()),
    })
  );
}

/** Both records enter the existing offline queue before another step can run. */
export function chooseLocalSimulation(options: {
  readonly room: LocalSimulationRoom;
  readonly choice: GameSessionChoice;
  readonly projected: RoomState;
  readonly clock: Clock;
}): void {
  const { room, choice } = options;
  const before = GameSessionsAttr.from(room.getSnapshot()).current;
  const current = GameSessionsAttr.from(options.projected).current;
  const at = Math.floor(options.clock.now());
  let revision = choice.revision;
  if (
    before !== null &&
    current?.execution !== undefined &&
    current.id === choice.gameId &&
    before.revision === choice.revision
  ) {
    dispatchLocalSimulation(
      room,
      CheckpointLocalSimulation({
        gameId: current.id,
        position: current.fen,
        execution: current.execution,
        previousEpoch: current.execution.epoch,
        at,
      })
    );
    revision = GameSessionsAttr.from(room.getSnapshot()).current!.revision;
  }
  dispatchLocalSimulation(
    room,
    ChangeLocalGameSession({ choice: { ...choice, revision }, at })
  );
}
