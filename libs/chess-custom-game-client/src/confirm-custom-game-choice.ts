import type { CustomGameChoice } from '@libs/chess-custom-game-shared/custom-game-choice';
import {
  ChangeCustomGame,
  CustomGamesChanged,
} from '@libs/chess-custom-game-shared/custom-game-commands';
import type { Timers } from '@pkgs/clock-shared/types';
import type {
  RoomClient,
  RoomCommandResult,
} from '@pkgs/room-client/room-client';
import { RoomMetaAttr } from '@pkgs/room-client/room-meta';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room-shared/types';

type CustomGameRoom = RoomClient<
  RoomState,
  RoomCommandPayload,
  RoomEvent,
  string
>;

/** Only a committed event acknowledges a choice; an optimistic event cannot. */
export function confirmCustomGameChoice(
  args: {
    room: CustomGameRoom | undefined;
    timers: Timers;
    pending: Set<() => void>;
  },
  choice: CustomGameChoice
): Promise<void> {
  const room = args.room;
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
