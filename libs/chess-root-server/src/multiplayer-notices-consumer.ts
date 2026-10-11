import { notifyUserChannels } from '@libs/app-root-server/notify-user-channels';
import { apiRequestAsyncLocalStorage } from '@libs/app-root-shared/request-scope';
import { dismissMultiplayerResultNotice } from '@libs/chess-matchmaking-shared/dismiss-result-notice-mutation';
import { MultiplayerGameRepository } from '@libs/chess-matchmaking-shared/game-repository';
import type { MultiplayerGame } from '@libs/chess-matchmaking-shared/game-state';
import { MULTIPLAYER_LINK_ROUTE } from '@libs/chess-matchmaking-shared/multiplayer-link';
import type { MultiplayerNoticePerson } from '@libs/chess-matchmaking-shared/multiplayer-notices';
import {
  DISMISS_RESULT_NOTICE_ACTION,
  MULTIPLAYER_NOTICE_NAMESPACE,
  MULTIPLAYER_RESULT_NOTICE,
  MultiplayerNoticesDue,
  multiplayerNotices,
  multiplayerResultNoticeSource,
  multiplayerTurnNoticeSource,
} from '@libs/chess-matchmaking-shared/multiplayer-notices';
import { Notifications } from '@libs/notifications-server/notifications-service';
import { findNotificationBySource } from '@libs/notifications-server/publish';
import { registerNotificationActionHandler } from '@libs/notifications-shared/action-registry';
import { NotificationsError } from '@libs/notifications-shared/notifications-errors';
import type { PublishNotificationInput } from '@libs/notifications-shared/publish-types';
import { ProfileReadRepository } from '@libs/profile-shared/read-profile';
import { assert } from '@pkgs/assert-root-shared/singleton';
import { defineOutboxConsumer } from '@pkgs/outbox-shared/define-consumer';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import {
  flaggedSide,
  resultNoticeTitle,
  resultReasonText,
  turnNoticeTitle,
} from './multiplayer-notice-text';

/** Where opening either notice takes its reader. */
const MULTIPLAYER_DEEP_LINK = { path: MULTIPLAYER_LINK_ROUTE } as const;

type Opponent = {
  readonly userId: string;
  readonly username: string;
  readonly avatarConfig: string | null;
};

function opponentLabel(opponent: Opponent): string {
  return opponent.username.length === 0 ? 'Someone' : `@${opponent.username}`;
}

function presentation(
  opponent: Opponent,
  text: { readonly title: string; readonly body?: string | undefined }
): PublishNotificationInput['presentation'] {
  return {
    title: text.title,
    ...(text.body === undefined ? {} : { body: text.body }),
    avatar: {
      fallbackLabel: opponentLabel(opponent),
      avatarConfig: opponent.avatarConfig,
    },
    deepLink: MULTIPLAYER_DEEP_LINK,
  };
}

type Reconcile = {
  readonly tx: SqlTx;
  readonly notifications: Notifications;
  readonly game: MultiplayerGame;
  readonly person: MultiplayerNoticePerson;
  readonly opponent: Opponent;
};

/**
 * The person to move has one turn notice. A new turn brings it back unread;
 * the same turn delivered twice leaves it as the person left it.
 */
async function reconcileTurnNotice(r: Reconcile): Promise<void> {
  const source = multiplayerTurnNoticeSource(r.game.id);
  if (!r.person.turn) {
    await r.notifications.deactivate({ userId: r.person.userId, source });
    return;
  }
  const existing = await findNotificationBySource(r.tx, {
    userId: r.person.userId,
    source,
  });
  await r.notifications.send({
    userId: r.person.userId,
    source,
    category: 'action_required',
    presentation: presentation(r.opponent, {
      title: turnNoticeTitle(opponentLabel(r.opponent)),
    }),
    actions: [],
    payload: {
      gameId: r.game.id,
      revision: r.game.revision,
      opponentUserId: r.opponent.userId,
      opponentUsername: r.opponent.username,
    },
    groupKey: 'chess:multiplayer-turns',
    priority: 10,
    resurface:
      existing === null ||
      !existing.isActive ||
      existing.payload['revision'] !== r.game.revision,
  });
}

/** Both people keep a result notice until each dismisses their own. */
async function reconcileResultNotice(r: Reconcile): Promise<void> {
  if (r.person.result === null) return;
  await r.notifications.send({
    userId: r.person.userId,
    source: multiplayerResultNoticeSource(r.game.id),
    category: 'informational',
    presentation: presentation(r.opponent, {
      title: resultNoticeTitle(r.person.result, opponentLabel(r.opponent)),
      body:
        r.person.result === 'aborted' ? undefined : resultReasonText(r.game),
    }),
    actions: [
      { id: DISMISS_RESULT_NOTICE_ACTION, label: 'Dismiss', variant: 'ghost' },
    ],
    payload: {
      gameId: r.game.id,
      result: r.person.result,
      reason: r.game.reason,
      flaggedSide: flaggedSide(r.game),
      opponentUserId: r.opponent.userId,
      opponentUsername: r.opponent.username,
    },
    groupKey: 'chess:multiplayer-results',
    priority: 5,
  });
}

/** Brings both people's inboxes in line with their daily game as it stands. */
export const multiplayerNoticesConsumer = defineOutboxConsumer({
  id: 'chess.multiplayer-notices',
  on: MultiplayerNoticesDue,
  async handler({ tx, clock, createId }, payload) {
    const game = await new MultiplayerGameRepository(tx).byId(payload.gameId);
    if (game === null) return;
    const notifications = new Notifications({ tx, clock, createId });
    const profiles = new ProfileReadRepository(tx);
    for (const person of multiplayerNotices(game)) {
      // A deleted account has no inbox to write to.
      if ((await profiles.readCardById(person.userId)) === null) continue;
      const card = await profiles.readCardById(person.opponentId);
      const opponent: Opponent = {
        userId: person.opponentId,
        username: card?.username ?? '',
        avatarConfig: card?.avatarConfig ?? null,
      };
      const reconcile = { tx, notifications, game, person, opponent };
      await reconcileTurnNotice(reconcile);
      await reconcileResultNotice(reconcile);
    }
    return { notifyUserIds: [game.white_id, game.black_id] };
  },
});

/**
 * Dismiss on a result notice's inbox card runs the same decision the
 * multiplayer command does, as the person answering.
 */
export function registerMultiplayerNoticeActions(): void {
  registerNotificationActionHandler(
    MULTIPLAYER_NOTICE_NAMESPACE,
    async (ctx) => {
      const gameId = ctx.interaction.payload['gameId'];
      if (
        ctx.actionId !== DISMISS_RESULT_NOTICE_ACTION ||
        ctx.interaction.sourceType !== MULTIPLAYER_RESULT_NOTICE ||
        typeof gameId !== 'string'
      )
        throw new NotificationsError(
          'NOTIFICATIONS_UNKNOWN_ACTION',
          `Unknown multiplayer notice action: ${ctx.actionId}`
        );
      const store = apiRequestAsyncLocalStorage.getStore();
      assert.defined(store, 'multiplayer notices: request store missing');
      await dismissMultiplayerResultNotice(
        ctx.sql,
        { gameId, userId: ctx.actorId },
        store.clock.now()
      );
      await notifyUserChannels([ctx.actorId], 'chess-multiplayer-notices', {
        tables: ['notifications'],
        deferPublish: false,
      });
    }
  );
}
