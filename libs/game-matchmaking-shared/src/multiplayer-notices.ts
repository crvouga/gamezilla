import type { NotificationSource } from '@libs/notifications-shared/notification-id';
import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import { insertOutboxEvent } from '@pkgs/outbox-shared/outbox';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import { GAME_PLATFORM_NAMESPACE } from './durable-names';
import type { MultiplayerGame } from './game-state';
import { lowOnTimeAtMs } from './multiplayer-clock';
import { isDailyTimeControl } from './time-control';

const messages = createMessageNamespace(GAME_PLATFORM_NAMESPACE, 'outbox');

/** A daily game's turn or result changed: its people's inboxes follow it. */
export const MultiplayerNoticesDue = messages(
  'multiplayer-notices',
  (value: unknown): value is { readonly gameId: string } =>
    isPlainRecord(value) &&
    typeof value['gameId'] === 'string' &&
    value['gameId'].length > 0
);

/**
 * The clock of the person to move in a daily game becomes low on time at
 * this event's time, unless they move first: `revision` names that turn.
 */
export const MultiplayerTurnReminderDue = messages(
  'multiplayer-turn-reminder',
  (
    value: unknown
  ): value is { readonly gameId: string; readonly revision: number } =>
    isPlainRecord(value) &&
    typeof value['gameId'] === 'string' &&
    value['gameId'].length > 0 &&
    typeof value['revision'] === 'number' &&
    Number.isInteger(value['revision'])
);

export const MULTIPLAYER_NOTICE_NAMESPACE = GAME_PLATFORM_NAMESPACE;
export const MULTIPLAYER_TURN_NOTICE = 'multiplayer-turn';
export const MULTIPLAYER_RESULT_NOTICE = 'multiplayer-result';
/** The one thing a person can do to a result notice from its inbox card. */
export const DISMISS_RESULT_NOTICE_ACTION = 'dismiss';

export function multiplayerTurnNoticeSource(
  gameId: string
): NotificationSource {
  return {
    namespace: MULTIPLAYER_NOTICE_NAMESPACE,
    type: MULTIPLAYER_TURN_NOTICE,
    id: gameId,
  };
}

export function multiplayerResultNoticeSource(
  gameId: string
): NotificationSource {
  return {
    namespace: MULTIPLAYER_NOTICE_NAMESPACE,
    type: MULTIPLAYER_RESULT_NOTICE,
    id: gameId,
  };
}

/** How a daily game ended for one of its two people. */
export type MultiplayerNoticeResult = 'won' | 'lost' | 'drawn' | 'aborted';

export type MultiplayerNoticePerson = {
  readonly userId: string;
  readonly opponentId: string;
  /** It is this person's turn in the unfinished game. */
  readonly turn: boolean;
  /** How the game ended for this person; null while it is unfinished. */
  readonly result: MultiplayerNoticeResult | null;
};

type NoticeFields = Pick<
  MultiplayerGame,
  'white_id' | 'black_id' | 'turn' | 'outcome' | 'time_control'
>;

function resultFor(
  game: NoticeFields,
  side: 'white' | 'black'
): MultiplayerNoticeResult | null {
  if (game.outcome === 'ongoing') return null;
  if (game.outcome === 'aborted') return 'aborted';
  if (game.outcome === 'draw') return 'drawn';
  return game.outcome === side ? 'won' : 'lost';
}

/**
 * The notices a game's two people should have as it stands: a turn notice
 * for the person to move while it is unfinished, and each person's result
 * once it is over or aborted. Only a daily game brings any; nobody but its
 * two people is ever named.
 */
export function multiplayerNotices(
  game: NoticeFields
): readonly MultiplayerNoticePerson[] {
  if (!isDailyTimeControl(game.time_control)) return [];
  const person = (
    side: 'white' | 'black',
    userId: string,
    opponentId: string
  ): MultiplayerNoticePerson => ({
    userId,
    opponentId,
    turn: game.outcome === 'ongoing' && game.turn === userId,
    result: resultFor(game, side),
  });
  return [
    person('white', game.white_id, game.black_id),
    person('black', game.black_id, game.white_id),
  ];
}

/**
 * A turn of an unfinished daily game gets one turn reminder, due when the
 * clock of the person to move becomes low on time. The event is named after
 * the turn, so a replay never brings a second one.
 */
async function scheduleTurnReminder(
  tx: SqlTx,
  game: MultiplayerGame,
  nowMs: number
): Promise<void> {
  const dueAt = lowOnTimeAtMs(game);
  if (dueAt === null) return;
  await insertOutboxEvent(tx, {
    id: `chess.multiplayer-turn-reminder:${JSON.stringify([game.id, game.revision])}`,
    message: MultiplayerTurnReminderDue({
      gameId: game.id,
      revision: game.revision,
    }),
    nowIso: new Date(nowMs).toISOString(),
    availableAt: new Date(dueAt),
  });
}

/**
 * Has the server bring both inboxes in line whenever a daily game starts or
 * its turn or result changes, and remind the person to move when their
 * clock becomes low on time. One delivery per state, so a replay is
 * harmless.
 */
export async function scheduleMultiplayerNotices(
  tx: SqlTx,
  change: {
    readonly before: NoticeFields | null;
    readonly after: MultiplayerGame;
  },
  nowMs: number
): Promise<void> {
  const { before, after } = change;
  if (!isDailyTimeControl(after.time_control)) return;
  if (
    before !== null &&
    before.turn === after.turn &&
    before.outcome === after.outcome
  )
    return;
  await insertOutboxEvent(tx, {
    id: `chess.multiplayer-notices:${JSON.stringify([after.id, after.revision, after.outcome])}`,
    message: MultiplayerNoticesDue({ gameId: after.id }),
    nowIso: new Date(nowMs).toISOString(),
  });
  await scheduleTurnReminder(tx, after, nowMs);
}
