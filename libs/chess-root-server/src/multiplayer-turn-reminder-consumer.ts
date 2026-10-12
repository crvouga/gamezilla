import { MultiplayerGameRepository } from '@libs/chess-matchmaking-shared/game-repository';
import {
  clockLeftMs,
  clockLowOnTime,
  sideToMove,
} from '@libs/chess-matchmaking-shared/multiplayer-clock';
import {
  MultiplayerTurnReminderDue,
  multiplayerNotices,
} from '@libs/chess-matchmaking-shared/multiplayer-notices';
import { Notifications } from '@libs/notifications-server/notifications-service';
import { ProfileReadRepository } from '@libs/profile-shared/read-profile';
import { defineOutboxConsumer } from '@pkgs/outbox-shared/define-consumer';
import { timeLeftText } from './multiplayer-notice-text';
import { noticeOpponent, sendTurnNotice } from './multiplayer-turn-notice';

/**
 * The clock of the person to move in a daily game has become low on time:
 * their turn notice comes back unread as a turn reminder with the time they
 * have left. Nothing happens once they have moved or the game is over or
 * aborted, so a turn brings at most one.
 */
export const multiplayerTurnReminderConsumer = defineOutboxConsumer({
  id: 'chess.multiplayer-turn-reminder',
  on: MultiplayerTurnReminderDue,
  async handler({ tx, clock, createId }, payload) {
    const game = await new MultiplayerGameRepository(tx).byId(payload.gameId);
    if (game === null || game.revision !== payload.revision) return;
    const side = sideToMove(game);
    const nowMs = clock.now();
    if (!clockLowOnTime(game, side, nowMs)) return;
    const person = multiplayerNotices(game).find((p) => p.turn);
    if (person === undefined) return;
    const profiles = new ProfileReadRepository(tx);
    // A deleted account has no inbox to write to.
    if ((await profiles.readCardById(person.userId)) === null) return;
    await sendTurnNotice(
      {
        tx,
        notifications: new Notifications({ tx, clock, createId }),
        game,
        person,
        opponent: await noticeOpponent(profiles, person),
      },
      timeLeftText(clockLeftMs(game, side, nowMs))
    );
    return { notifyUserIds: [person.userId] };
  },
});
