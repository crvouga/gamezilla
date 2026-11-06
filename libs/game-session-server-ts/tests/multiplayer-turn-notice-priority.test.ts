import { expect, test } from 'bun:test';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { sendTurnNotice } from '@libs/game-session-server-ts/multiplayer-turn-notice';
import type { Notifications } from '@libs/notifications-server-ts/notifications-service';
import { TIME_CRITICAL_PRIORITY } from '@libs/notifications-shared-ts/notifications-sections';
import type { PublishNotificationInput } from '@libs/notifications-shared-ts/publish-types';

/** Sends a person's turn notice into an empty inbox; returns what was published. */
async function published(
  remindLeft: string | null
): Promise<PublishNotificationInput> {
  const sent: PublishNotificationInput[] = [];
  const notifications = {
    send: (input: PublishNotificationInput) => {
      sent.push(input);
      return Promise.resolve();
    },
  } as unknown as Notifications;
  await sendTurnNotice(
    {
      tx: {
        query: () => Promise.resolve([]),
        run: () => Promise.resolve({ changes: 0, lastInsertRowid: 0 }),
      },
      notifications,
      game: { id: 'game-1', revision: 3 } as MultiplayerGame,
      gameType: 'a-turn-game',
      person: { userId: 'sam', opponentId: 'avery', turn: true, result: null },
      opponent: { userId: 'avery', username: 'avery', avatarConfig: null },
    },
    remindLeft
  );
  expect(sent).toHaveLength(1);
  return sent[0] as PublishNotificationInput;
}

// regression: inbox-low-on-time-turn-ranks-late — a turn reminder kept the
// turn notice's priority and its first arrival time, so a turn with 3 hours
// left listed under a newer turn and a routine friend request. A turn
// reminder now publishes at the time-critical priority, so the inbox (which
// lists by priority first) puts it ahead of everything else that needs the
// person; a plain turn notice stays below it.
test('a turn reminder outranks a plain turn notice', async () => {
  const reminder = await published('3 hours');
  const turn = await published(null);
  expect(reminder.priority).toBe(TIME_CRITICAL_PRIORITY);
  expect(turn.priority ?? 0).toBeLessThan(TIME_CRITICAL_PRIORITY);
  expect(turn.priority ?? 0).toBeGreaterThan(0);
});
