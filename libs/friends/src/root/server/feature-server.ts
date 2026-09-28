/**
 * What friends contributes to a server: the outbox consumers that turn a
 * friend request into a delivery, and the handler for the inbox actions those
 * deliveries carry.
 *
 * Notifications owns the inbox and knows nothing about friend requests;
 * friends registers into the namespace it owns when the servers are folded.
 */

import { defineFeatureServer } from '@libs/feature/public/server';
import { registerNotificationActionHandler } from '@libs/notifications/public/notifications';
import { notificationsActorStorage } from '@libs/notifications/root/server/notifications-route';
import { apiRequestAsyncLocalStorage } from '@libs/server-app/request-scope';
import { notifyUserChannels } from '@libs/server-app/sync/notify-user-channels';
import { drainAndNotifyOutbox } from '@libs/server-app/sync/outbox-drain';
import { assert } from '@pkgs/assert';

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
      db: store.sqlClient,
      clock: store.clock,
      createId: store.createId,
    });
    // OOB domain writes bypass mutation-replay fanout. Publish synchronously
    // (same as outbox-drain) so DST harness timers need not advance for peers to
    // refetch friendships / requests. Omit `tables` so every active scope wakes.
    await notifyUserChannels(
      result.userIds,
      `friends-notifications:${ctx.actionId}`,
      { deferPublish: false }
    );
  });
}

export const FRIENDS_SERVER = defineFeatureServer({
  name: 'friends',
  register: registerFriendsInboxActions,
  registerOutbox: (registry) => {
    registry.register(friendRequestSentNotifyConsumer);
    registry.register(friendRequestAcceptedNotifyConsumer);
    registry.register(friendRequestClosedNotifyConsumer);
  },
});
