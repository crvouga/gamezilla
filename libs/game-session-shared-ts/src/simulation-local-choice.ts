import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { Message } from '@pkgs/message-shared-ts/message';
import type { RoomState } from '@pkgs/room-root-shared-ts/types';
import type { CustomGameChoice } from './custom-game-choice';
import { ChangeLocalCustomGame } from './custom-game-commands';
import { CustomGameNoticeAttr } from './custom-game-router';
import { CustomGamesAttr } from './custom-game-state';
import type { LocalSimulationRoom } from './simulation-local-session';
import { CheckpointLocalSimulation } from './simulation-session-state';

function dispatch(room: LocalSimulationRoom, message: Message): void {
  const id = room.dispatch(message);
  if (id === null)
    throw new Error('the game could not be saved; reopen it to try again');
  const notice = CustomGameNoticeAttr.from(room.getSnapshot());
  if (notice.commandId === id && notice.reason !== '')
    throw new Error(notice.reason);
}

/** Both records enter the existing offline queue before another step can run. */
export function chooseLocalSimulation(options: {
  readonly room: LocalSimulationRoom;
  readonly choice: CustomGameChoice;
  readonly projected: RoomState;
  readonly clock: Clock;
}): void {
  const { room, choice } = options;
  const before = CustomGamesAttr.from(room.getSnapshot()).current;
  const current = CustomGamesAttr.from(options.projected).current;
  const at = Math.floor(options.clock.now());
  let revision = choice.revision;
  if (
    before !== null &&
    current?.execution !== undefined &&
    current.id === choice.gameId &&
    before.revision === choice.revision
  ) {
    dispatch(
      room,
      CheckpointLocalSimulation({
        gameId: current.id,
        position: current.fen,
        execution: current.execution,
        previousEpoch: current.execution.epoch,
        at,
      })
    );
    revision = CustomGamesAttr.from(room.getSnapshot()).current!.revision;
  }
  dispatch(
    room,
    ChangeLocalCustomGame({ choice: { ...choice, revision }, at })
  );
}
