import { notifyUserChannels } from '@libs/app-root-server-ts/notify-user-channels';
import { apiRequestAsyncLocalStorage } from '@libs/app-root-shared-ts/request-scope';
import { dismissMultiplayerResultNotice } from '@libs/game-matchmaking-shared-ts/dismiss-result-notice-mutation';
import { MultiplayerGameRepository } from '@libs/game-matchmaking-shared-ts/game-repository';
import {
  DISMISS_RESULT_NOTICE_ACTION,
  MULTIPLAYER_NOTICE_NAMESPACE,
  MULTIPLAYER_RESULT_NOTICE,
  MultiplayerNoticesDue,
  multiplayerNotices,
  multiplayerResultNoticeSource,
  multiplayerTurnNoticeSource,
} from '@libs/game-matchmaking-shared-ts/multiplayer-notices';
import { Notifications } from '@libs/notifications-server-ts/notifications-service';
import { registerNotificationActionHandler } from '@libs/notifications-shared-ts/action-registry';
import { NotificationsError } from '@libs/notifications-shared-ts/notifications-errors';
import { ProfileReadRepository } from '@libs/profile-shared-ts/read-profile';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import { defineOutboxConsumer } from '@pkgs/outbox-shared-ts/define-consumer';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import {
  flaggedSide,
  resultNoticeTitle,
  resultReasonText,
} from './multiplayer-notice-text';
import type { NoticeReconcile } from './multiplayer-turn-notice';
import {
  noticeOpponent,
  noticePresentation,
  opponentLabel,
  sendTurnNotice,
} from './multiplayer-turn-notice';

/**
 * The person to move has one turn notice. A new turn brings it back unread;
 * the same turn delivered twice leaves it as the person left it.
 */
async function reconcileTurnNotice(r: NoticeReconcile): Promise<void> {
  if (r.person.turn) {
    await sendTurnNotice(r, null);
    return;
  }
  await r.notifications.deactivate({
    userId: r.person.userId,
    source: multiplayerTurnNoticeSource(r.game.id),
  });
}

/** Both people keep a result notice until each dismisses their own. */
async function reconcileResultNotice(r: NoticeReconcile): Promise<void> {
  if (r.person.result === null) return;
  await r.notifications.send({
    userId: r.person.userId,
    source: multiplayerResultNoticeSource(r.game.id),
    category: 'informational',
    presentation: noticePresentation(
      r.opponent,
      {
        title: resultNoticeTitle(r.person.result, opponentLabel(r.opponent)),
        body:
          r.person.result === 'aborted'
            ? undefined
            : resultReasonText(r.game, r.text),
      },
      r.gameType
    ),
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
export function createMultiplayerNoticesConsumer(rules: TurnGames) {
  return defineOutboxConsumer({
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
        const opponent = await noticeOpponent(profiles, person);
        const reconcile = {
          tx,
          notifications,
          game,
          person,
          opponent,
          gameType: rules.forPosition(game.fen).id,
          text: rules.capability(rules.forPosition(game.fen).id, 'matchmaking')
            ?.notice,
        };
        await reconcileTurnNotice(reconcile);
        await reconcileResultNotice(reconcile);
      }
      return { notifyUserIds: [game.white_id, game.black_id] };
    },
  });
}

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
      });
    }
  );
}
