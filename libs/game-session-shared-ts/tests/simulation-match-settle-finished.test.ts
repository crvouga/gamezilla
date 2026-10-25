import { expect, test } from 'bun:test';
import { settleMultiplayerClockMutation } from '@libs/game-matchmaking-shared-ts/settle-multiplayer-clock-mutation';
import { synchronizeLiveMatchMutation } from '@libs/game-matchmaking-shared-ts/synchronize-live-match-mutation';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';
import { matchedProjection } from './reference-matched-projection';

test('a device asking to settle a live match that already ended changes nothing', async () => {
  // regression: late-settle-erases-a-live-match-rating
  const fixture = await matchedProjection();
  try {
    await fixture.rig.connect('alice');
    await fixture.rig.connect('bob');
    await fixture.rig.advance(65);
    await fixture.db.transaction((tx) =>
      synchronizeLiveMatchMutation.run(
        { tx: wrapMutationDb(tx, fixture.env).tx, env: fixture.env },
        { gameId: 'race-1', requestId: 'projection' }
      )
    );
    const ended = await fixture.stored();
    expect(ended?.outcome).toBe('white');
    // Her device still showed the durable game ongoing when it asked.
    for (const requestId of ['late-settle-1', 'late-settle-2'])
      await fixture.db.transaction((tx) =>
        settleMultiplayerClockMutation.run(
          { tx: wrapMutationDb(tx, fixture.env).tx, env: fixture.env },
          { gameId: 'race-1', spaceId: 'alice-space', requestId }
        )
      );
    expect(await fixture.stored()).toEqual(ended);
    expect(fixture.rig.errors).toEqual([]);
  } finally {
    await fixture.dispose();
  }
});
