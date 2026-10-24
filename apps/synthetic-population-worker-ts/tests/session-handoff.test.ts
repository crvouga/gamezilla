import { expect, test } from 'bun:test';
import type { ManagedSession } from '@apps/synthetic-population-worker-ts/managed-session';
import { checkpointSchema } from '@libs/synthetic-population-shared-ts/config';
import { runtimeBackend } from './runtime-backend';
import {
  awaitRuntimeUsers,
  runtimeHeartbeat,
  runtimeSession,
} from './runtime-session';

test.each([1, 99])(
  'replacement realms resume authoritative matches and fence expired owners with snapshot version %i',
  async (schemaVersion) => {
    // regression: synthetic-population-recovery-waits-outside-game
    // regression: synthetic-native-pair-different-games
    // regression: synthetic-population-incompatible-snapshot-loses-match
    // regression: synthetic-population-native-fixture-expiry
    // regression: synthetic-native-realms-incompatible-game-pools
    const backend = await runtimeBackend(2);
    const sessions: ManagedSession[] = [];
    try {
      const firstWorker = backend.wall.createId();
      await runtimeHeartbeat(backend, firstWorker, 'release-one');
      const first = await Promise.all(
        [0, 1].map(async () => {
          const realm = await runtimeSession(
            backend,
            firstWorker,
            'release-one'
          );
          sessions.push(realm.session);
          await realm.authenticated;
          return realm;
        })
      );
      const playing = await awaitRuntimeUsers(backend, async (users) => {
        if (
          !users.every(
            (user) =>
              user.activity === 'playing' &&
              checkpointSchema.parse(user.checkpoint).matchId !== null
          )
        )
          return false;
        // regression: synthetic-population-handoff-observes-recent-telemetry
        // First moves must be accepted by the game server before advancing time.
        // Recent telemetry is bounded and is not the authority for this condition.
        const moves = await backend.acceptedGameMoves();
        return users.every((user) =>
          moves.some(
            (move) =>
              move.owner_id === user.account_id &&
              move.game_id === checkpointSchema.parse(user.checkpoint).matchId
          )
        );
      });
      const matches = new Map(
        playing.map((user) => [
          user.id,
          {
            account: user.account_id,
            match: checkpointSchema.parse(user.checkpoint).matchId,
          },
        ])
      );
      // Abrupt termination cannot publish a final checkpoint or release ownership.
      for (const realm of first) realm.stopRenewing();
      first[0]!.session.abort();
      backend.advanceServerTime(first[0]!.assignment.config.leaseMs + 1);
      // A partitioned old realm is still alive here. Backend ownership rejects it.
      expect(await first[1]!.session.renew(false)).toBe(false);
      if (schemaVersion !== 1)
        for (const user of playing)
          await backend.replaceStoredCheckpoint(user.id, {
            ...user.checkpoint,
            schemaVersion,
          });
      const nextWorker = backend.wall.createId();
      await runtimeHeartbeat(backend, nextWorker, 'release-two');
      const replacements = await Promise.all(
        [0, 1].map(async () => {
          const realm = await runtimeSession(
            backend,
            nextWorker,
            'release-two'
          );
          sessions.push(realm.session);
          await realm.authenticated;
          return realm;
        })
      );
      const recovered = await awaitRuntimeUsers(backend, async (users) => {
        if (
          !users.every(
            (user) =>
              user.activity === 'playing' &&
              user.application_version === 'release-two'
          )
        )
          return false;
        const timelines = await Promise.all(
          users.map((user) => backend.repository.events(user.id))
        );
        return timelines.every((events) =>
          events.some(
            (event) => event.generation === 2 && event.event === 'MoveSubmitted'
          )
        );
      });
      expect(recovered).toHaveLength(2);
      for (const user of recovered) {
        expect(user.account_id).toBe(matches.get(user.id)!.account);
        expect(checkpointSchema.parse(user.checkpoint).matchId).toBe(
          matches.get(user.id)!.match
        );
        expect(user.generation).toBe(2);
        expect(user.worker_id).toBe(nextWorker);
        expect(user.last_error).toBeNull();
      }
      for (const realm of replacements)
        expect(realm.assignment.registered).toBe(true);
    } finally {
      for (const session of sessions) session.abort();
      await backend.close();
    }
  },
  60_000
);
