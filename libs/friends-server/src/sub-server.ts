/**
 * What friends contributes to a server: the outbox consumers that turn a
 * friend request into a delivery, and the handler for the inbox actions those
 * deliveries carry.
 *
 * Notifications owns the inbox and knows nothing about friend requests;
 * friends registers into the namespace it owns when the servers are folded.
 */

import { notifyUserChannels } from '@libs/app-root-server/notify-user-channels';
import { drainAndNotifyOutbox } from '@libs/app-root-server/outbox-drain';
import { apiRequestAsyncLocalStorage } from '@libs/app-root-shared/request-scope';
import { notificationsActorStorage } from '@libs/notifications-server/notifications-route';
import { registerNotificationActionHandler } from '@libs/notifications-shared/action-registry';
import { defineSubServer } from '@libs/sub-shared/server';
import { assert } from '@pkgs/assert-root-shared/singleton';

import {
  friendRequestAcceptedNotifyConsumer,
  friendRequestClosedNotifyConsumer,
  friendRequestSentNotifyConsumer,
} from './friends-outbox-consumers';
import { HandleFriendsNotificationsActionUseCase } from './handle-friends-notifications-action-use-case';

function registerFriendsInboxActions(): void {
  registerNotificationActionHandler('friends', async (ctx) => {
    const payload = ctx.interaction.payload;
    const requestId =
      typeof payload['requestId'] === 'string' ? payload['requestId'] : null;
    if (requestId === null) {
      throw new Error('Missing requestId in notification payload');
    }
    const actor = notificationsActorStorage.getStore();
    assert.defined(actor, 'friends notifications: actor missing');
    const store = apiRequestAsyncLocalStorage.getStore();
    assert.defined(store, 'friends notifications: request store missing');
    const result = await new HandleFriendsNotificationsActionUseCase(
      store.sqlClient,
      { clock: store.clock, createId: store.createId }
    ).execute({
      actorId: ctx.actorId,
      deviceId: actor.deviceId,
      actionId: ctx.actionId,
      requestId,
    });
    await drainAndNotifyOutbox({
      objectStore: store.objectStore,
      db: store.sqlClient,
      clock: store.clock,
      createId: store.createId,
    });
    // OOB domain writes bypass mutation-replay fanout. Publish synchronously
    // (same as outbox-drain) so DST harness timers need not advance for peers to
    // refetch friendships / requests. Omit `tables` so every active scope wakes.
    await notifyUserChannels(
      result.userIds,
      `friends-notifications:${ctx.actionId}`
    );
  });
}

export const FRIENDS_SERVER = defineSubServer({
  name: 'friends',
  register: registerFriendsInboxActions,
  registerOutbox: (registry) => {
    registry.register(friendRequestSentNotifyConsumer);
    registry.register(friendRequestAcceptedNotifyConsumer);
    registry.register(friendRequestClosedNotifyConsumer);
  },
});
