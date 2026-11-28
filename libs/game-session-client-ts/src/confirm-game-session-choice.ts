import type { GameSessionChoice } from '@libs/game-session-shared-ts/game-session-choice';
import {
  ChangeGameSession,
  ChangeLocalGameSession,
  gameSessionChangeAnswer,
} from '@libs/game-session-shared-ts/game-session-commands';
import { localGameSessionChoiceAllowed } from '@libs/game-session-shared-ts/game-session-local';
import { GameSessionNoticeAttr } from '@libs/game-session-shared-ts/game-session-router';
import { GameSessionsAttr } from '@libs/game-session-shared-ts/game-session-state';
import { gameSessionChoiceWaits } from '@libs/game-session-shared-ts/game-session-waiting-move';
import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type {
  RoomClient,
  RoomCommandResult,
} from '@pkgs/room-root-client-ts/room-client';
import { RoomMetaAttr } from '@pkgs/room-root-client-ts/room-meta';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';

type GameSessionRoom = RoomClient<
  RoomState,
  RoomCommandPayload,
  RoomEvent,
  string
>;

type ConfirmationArgs = {
  room: GameSessionRoom | undefined;
  timers: Timers;
  clock: Clock;
  canHost: boolean;
  pending: Set<() => void>;
  /** The registered games: a game with private setups never chooses on the device. */
  rules: TurnGames;
  /** Who makes the choice: only a participant's own move waits for the connection. */
  actor: string;
  /** The screen's live owner records current progress before a local choice. */
  chooseLocal?: (choice: GameSessionChoice) => Promise<void> | null;
  /** Told when the choice waits for the connection before it is sent. */
  onWaiting?: () => void;
  /**
   * Prepares a choice made on this device as the space's module does (a
   * solo start of a game with dealt hands draws its deal here once).
   */
  prepare?: (
    state: RoomState,
    payload: RoomCommandPayload
  ) => RoomCommandPayload;
};

function confirmLocalChoice(
  args: ConfirmationArgs,
  choice: GameSessionChoice
): Promise<string | null> | null {
  const room = args.room;
  if (
    room !== undefined &&
    args.canHost &&
    localGameSessionChoiceAllowed(
      GameSessionsAttr.from(room.getSnapshot()).current,
      choice,
      args.rules
    )
  ) {
    const local = ChangeLocalGameSession({
      choice,
      at: Math.floor(args.clock.now()),
    });
    const simulated =
      choice.operation === 'create' ? null : args.chooseLocal?.(choice);
    if (simulated != null) return simulated.then(() => null);
    const id = room.dispatch(
      args.prepare?.(room.getSnapshot(), local) ?? local
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
    const notice = GameSessionNoticeAttr.from(room.getSnapshot());
    return room.flushIo().then(() => {
      if (notice.commandId === id && notice.reason !== '')
        throw new Error(notice.reason);
      return id;
    });
  }
  return null;
}

function roomOnline(room: GameSessionRoom): boolean {
  return (
    RoomMetaAttr.isConnected.from(room.getSnapshot()) &&
    RoomMetaAttr.isSynced.from(room.getSnapshot())
  );
}

/** Whether `choice`, made with no connection, is sent once it returns. */
function waitsForConnection(
  room: GameSessionRoom,
  choice: GameSessionChoice,
  args: Pick<ConfirmationArgs, 'rules' | 'actor'>
): boolean {
  return gameSessionChoiceWaits(
    GameSessionsAttr.from(room.getSnapshot()).current,
    choice,
    args.rules,
    args.actor
  );
}

/** A create returns its command id, which the room uses as the new session id. */
export function confirmGameSessionChoice(
  args: ConfirmationArgs,
  choice: GameSessionChoice
): Promise<string | null> {
  const room = args.room;
  const local = confirmLocalChoice(args, choice);
  if (local !== null) return local;
  if (room === undefined) return Promise.reject(new Error('connection needed'));
  const online = (): boolean => roomOnline(room);
  if (!online()) {
    if (!waitsForConnection(room, choice, args))
      return Promise.reject(new Error('connection needed'));
    args.onWaiting?.();
  }
  return new Promise<string | null>((resolve, reject) => {
    let commandId: string | null = null;
    let result: RoomCommandResult | null = null;
    let done = false;
    let deadline: ReturnType<typeof args.timers.setTimeout> | null = null;
    const finish = (reason: string): void => {
      if (done) return;
      done = true;
      unsubscribe();
      unsubscribeResult();
      if (deadline !== null) args.timers.clearTimeout(deadline);
      args.pending.delete(cancel);
      if (reason === '') resolve(commandId);
      else reject(new Error(reason));
    };
    // A choice waiting for the connection is answered once it is sent.
    const awaitAnswer = (): void => {
      if (deadline !== null || done || !online()) return;
      deadline = args.timers.setTimeout(
        () => finish('confirmation did not arrive'),
        15_000
      );
    };
    const inspect = (): void => {
      awaitAnswer();
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
        .map((entry) => gameSessionChangeAnswer(entry.event))
        .findLast((answer) => answer?.commandId === commandId);
      if (fact != null) finish(fact.reason);
    };
    const cancel = (): void => finish('game closed before confirmation');
    const unsubscribe = room.subscribe(inspect);
    const unsubscribeResult = room.subscribeCommandResult((next) => {
      if (commandId !== null && next.commandId !== commandId) return;
      result = next;
      inspect();
    });
    awaitAnswer();
    args.pending.add(cancel);
    commandId = room.dispatch(ChangeGameSession(choice));
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
