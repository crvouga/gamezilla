import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { multiplayerLinkRoute } from '@libs/game-matchmaking-shared-ts/multiplayer-link';
import type { MultiplayerNoticePerson } from '@libs/game-matchmaking-shared-ts/multiplayer-notices';
import { multiplayerTurnNoticeSource } from '@libs/game-matchmaking-shared-ts/multiplayer-notices';
import type { Notifications } from '@libs/notifications-server-ts/notifications-service';
import { findNotificationBySource } from '@libs/notifications-server-ts/publish';
import type { PublishNotificationInput } from '@libs/notifications-shared-ts/publish-types';
import type { ProfileReadRepository } from '@libs/profile-shared-ts/read-profile';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import type { GameNoticeText } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  turnNoticeTitle,
  turnReminderBody,
  turnReminderTitle,
} from './multiplayer-notice-text';

export type NoticeOpponent = {
  readonly userId: string;
  readonly username: string;
  readonly avatarConfig: string | null;
};

export function opponentLabel(opponent: NoticeOpponent): string {
  return opponent.username.length === 0 ? 'Someone' : `@${opponent.username}`;
}

/** The multiplayer opponent a person's notice names, as they are shown now. */
export async function noticeOpponent(
  profiles: ProfileReadRepository,
  person: MultiplayerNoticePerson
): Promise<NoticeOpponent> {
  const card = await profiles.readCardById(person.opponentId);
  return {
    userId: person.opponentId,
    username: card?.username ?? '',
    avatarConfig: card?.avatarConfig ?? null,
  };
}

export function noticePresentation(
  opponent: NoticeOpponent,
  text: { readonly title: string; readonly body?: string | undefined },
  gameType: string
): PublishNotificationInput['presentation'] {
  return {
    title: text.title,
    ...(text.body === undefined ? {} : { body: text.body }),
    avatar: {
      fallbackLabel: opponentLabel(opponent),
      avatarConfig: opponent.avatarConfig,
    },
    deepLink: { path: multiplayerLinkRoute(gameType) },
  };
}

export type NoticeReconcile = {
  readonly gameType: string;
  readonly text?: GameNoticeText | undefined;
  readonly tx: SqlTx;
  readonly notifications: Notifications;
  readonly game: MultiplayerGame;
  readonly person: MultiplayerNoticePerson;
  readonly opponent: NoticeOpponent;
};

/** The turn notice a person has for this game, whatever turn it is from. */
type HeldTurnNotice = {
  /** It is in the inbox, for the turn the game is on now. */
  readonly thisTurn: boolean;
  /** The time left its turn reminder gave; null while it is no reminder. */
  readonly reminderLeft: string | null;
};

async function heldTurnNotice(r: NoticeReconcile): Promise<HeldTurnNotice> {
  const existing = await findNotificationBySource(r.tx, {
    userId: r.person.userId,
    source: multiplayerTurnNoticeSource(r.game.id),
  });
  const thisTurn =
    existing?.isActive === true &&
    existing.payload['revision'] === r.game.revision;
  const left = existing?.payload['left'];
  return {
    thisTurn,
    reminderLeft:
      thisTurn &&
      existing?.payload['reminder'] === true &&
      typeof left === 'string'
        ? left
        : null,
  };
}

/**
 * The one turn notice of the person to move. A new turn brings it back
 * unread, and so does its turn reminder: `remindLeft` is the time the
 * person's clock has left, given once the clock is low on time. The same
 * state delivered twice leaves the notice as the person left it, and a turn
 * reminder stays one until the turn is over.
 */
export async function sendTurnNotice(
  r: NoticeReconcile,
  remindLeft: string | null
): Promise<void> {
  const held = await heldTurnNotice(r);
  const left = held.reminderLeft ?? remindLeft;
  const opponent = opponentLabel(r.opponent);
  await r.notifications.send({
    userId: r.person.userId,
    source: multiplayerTurnNoticeSource(r.game.id),
    category: 'action_required',
    presentation: noticePresentation(
      r.opponent,
      left === null
        ? { title: turnNoticeTitle(opponent) }
        : { title: turnReminderTitle(opponent), body: turnReminderBody(left) },
      r.gameType
    ),
    actions: [],
    payload: {
      gameId: r.game.id,
      revision: r.game.revision,
      opponentUserId: r.opponent.userId,
      opponentUsername: r.opponent.username,
      ...(left === null ? {} : { reminder: true, left }),
    },
    groupKey: 'chess:multiplayer-turns',
    priority: 10,
    resurface:
      !held.thisTurn || (remindLeft !== null && held.reminderLeft === null),
  });
}
