import type { CustomGameChoice } from '@libs/game-session-shared/custom-game-choice';
import {
  ChangeCustomGame,
  ChangeLocalCustomGame,
  CustomGamesChanged,
} from '@libs/game-session-shared/custom-game-commands';
import { localCustomGameChoiceAllowed } from '@libs/game-session-shared/custom-game-local';
import { CustomGameNoticeAttr } from '@libs/game-session-shared/custom-game-router';
import { CustomGamesAttr } from '@libs/game-session-shared/custom-game-state';
import type { Clock, Timers } from '@pkgs/clock-shared/types';
import type {
  RoomClient,
  RoomCommandResult,
} from '@pkgs/room-root-client/room-client';
import { RoomMetaAttr } from '@pkgs/room-root-client/room-meta';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room-root-shared/types';

type CustomGameRoom = RoomClient<
  RoomState,
  RoomCommandPayload,
  RoomEvent,
  string
>;

type ConfirmationArgs = {
  room: CustomGameRoom | undefined;
  timers: Timers;
  clock: Clock;
  canHost: boolean;
  pending: Set<() => void>;
};

function confirmLocalChoice(
  args: ConfirmationArgs,
  choice: CustomGameChoice
): Promise<void> | null {
  const room = args.room;
  if (
    room !== undefined &&
    args.canHost &&
    localCustomGameChoiceAllowed(
      CustomGamesAttr.from(room.getSnapshot()).current,
      choice
    )
  ) {
    const id = room.dispatch(
      ChangeLocalCustomGame({ choice, at: args.clock.now() })
    );
    if (id === null)
      return Promise.reject(
        new Error(
          String(
            RoomMetaAttr.lastError.from(room.getSnapshot())?.['reason'] ??
              'choice failed'
          )
        )
      );
    const notice = CustomGameNoticeAttr.from(room.getSnapshot());
    return room.flushIo().then(() => {
      if (notice.commandId === id && notice.reason !== '')
        throw new Error(notice.reason);
    });
  }
  return null;
}

/** Solo choices are durable locally; choices with others await agreement. */
export function confirmCustomGameChoice(
  args: ConfirmationArgs,
  choice: CustomGameChoice
): Promise<void> {
  const room = args.room;
  const local = confirmLocalChoice(args, choice);
  if (local !== null) return local;
  if (
    room === undefined ||
    !RoomMetaAttr.isConnected.from(room.getSnapshot()) ||
    !RoomMetaAttr.isSynced.from(room.getSnapshot())
  )
    return Promise.reject(new Error('connection needed'));
  return new Promise<void>((resolve, reject) => {
    let commandId: string | null = null;
    let result: RoomCommandResult | null = null;
    let done = false;
    const finish = (reason: string): void => {
      if (done) return;
      done = true;
      unsubscribe();
      unsubscribeResult();
      args.timers.clearTimeout(deadline);
      args.pending.delete(cancel);
      if (reason === '') resolve();
      else reject(new Error(reason));
    };
    const inspect = (): void => {
      if (commandId === null) return;
      if (result?.commandId === commandId && !result.ok) {
        const fault = result.error;
        finish(
          'reason' in fault ? (fault.reason ?? 'choice failed') : fault.type
        );
        return;
      }
      const fact = room
        .getLog()
        .findLast(
          (entry) =>
            CustomGamesChanged.is(entry.event) &&
            entry.event.payload.commandId === commandId
        );
      if (fact !== undefined && CustomGamesChanged.is(fact.event))
        finish(fact.event.payload.reason);
    };
    const cancel = (): void => finish('game closed before confirmation');
    const unsubscribe = room.subscribe(inspect);
    const unsubscribeResult = room.subscribeCommandResult((next) => {
      if (commandId !== null && next.commandId !== commandId) return;
      result = next;
      inspect();
    });
    const deadline = args.timers.setTimeout(
      () => finish('confirmation did not arrive'),
      15_000
    );
    args.pending.add(cancel);
    commandId = room.dispatch(ChangeCustomGame(choice));
    if (commandId === null)
      finish(
        String(
          RoomMetaAttr.lastError.from(room.getSnapshot())?.['reason'] ??
            'choice failed'
        )
      );
    else inspect();
  });
}
