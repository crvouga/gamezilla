import { describe, expect, test } from 'bun:test';
import { acceptanceApi } from '@apps/product/sim/acceptance/system';

import {
  aliceIdentity,
  applied,
  bobIdentity,
  type Json,
  login,
  query,
} from './support';

function ofType(rows: Json[], sourceType: string): Json[] {
  return rows.filter(
    (row) => row['source_type'] === sourceType && row['deleted_at'] === null
  );
}

function active(rows: Json[]): Json[] {
  return rows.filter((row) => row['active'] === true);
}

describe('Notifications / friend delivery', () => {
  test('NOTIF-001 a request notifies only the recipient and closes when decided', async () => {
    await using s = await acceptanceApi.run({ seed: 701 });
    const sender = await login(s, 1, aliceIdentity);
    const recipient = await login(s, 2, bobIdentity);
    const stranger = await login(s, 3, { sub: 'carol', email: null });
    await applied(s, sender, 'sendFriendRequest', {
      requestId: 'request-1',
      toUserId: recipient.accountId,
    });
    const inbox = (who: typeof sender) =>
      query(s, who, 'notificationsActive').then(
        (tables) => tables['notifications']!
      );
    const recipientRows = ofType(await inbox(recipient), 'friend-request');
    expect(active(recipientRows)).toHaveLength(1);
    expect(recipientRows[0]!['user_id']).toBe(recipient.accountId);
    expect(ofType(await inbox(sender), 'friend-request')).toHaveLength(0);
    expect(await inbox(stranger)).toEqual([]);
    await applied(s, recipient, 'declineFriendRequest', {
      requestId: 'request-1',
    });
    expect(
      active(ofType(await inbox(recipient), 'friend-request'))
    ).toHaveLength(0);
    expect(ofType(await inbox(sender), 'friend-request-accepted')).toHaveLength(
      0
    );
  });

  test('NOTIF-002 accepting notifies the sender and clears the request card', async () => {
    await using s = await acceptanceApi.run({ seed: 702 });
    const sender = await login(s, 1, aliceIdentity);
    const recipient = await login(s, 2, bobIdentity);
    await applied(s, sender, 'sendFriendRequest', {
      requestId: 'request-2',
      toUserId: recipient.accountId,
    });
    await applied(s, recipient, 'acceptFriendRequest', {
      requestId: 'request-2',
    });
    const recipientInbox = (await query(s, recipient, 'notificationsActive'))[
      'notifications'
    ]!;
    const senderInbox = (await query(s, sender, 'notificationsActive'))[
      'notifications'
    ]!;
    expect(active(ofType(recipientInbox, 'friend-request'))).toHaveLength(0);
    expect(active(ofType(senderInbox, 'friend-request-accepted'))).toHaveLength(
      1
    );
    expect(ofType(recipientInbox, 'friend-request-accepted')).toHaveLength(0);
  });

  test('NOTIF-003 switching accounts does not show the other inbox', async () => {
    await using s = await acceptanceApi.run({ seed: 703 });
    const sender = await login(s, 1, aliceIdentity);
    const recipient = await login(s, 2, bobIdentity);
    await applied(s, sender, 'sendFriendRequest', {
      requestId: 'request-3',
      toUserId: recipient.accountId,
    });
    const onSenderDevice = await login(s, 2, aliceIdentity);
    expect(
      (await query(s, onSenderDevice, 'notificationsActive'))['notifications']
    ).toEqual([]);
    const back = await login(s, 2, bobIdentity);
    expect(
      active(
        ofType(
          (await query(s, back, 'notificationsActive'))['notifications']!,
          'friend-request'
        )
      )
    ).toHaveLength(1);
  });
});
