import { expect, test } from 'bun:test';
import { MultiplayerDeadline } from '@libs/game-matchmaking-shared-ts/multiplayer-deadline';
import { settleDueGame } from '@libs/game-matchmaking-shared-ts/settle-due-game';
import { synchronizeLiveMatchMutation } from '@libs/game-matchmaking-shared-ts/synchronize-live-match-mutation';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';
import { matchedProjection } from './reference-matched-projection';

test('a continuous match has no turn clock and schedules existing outbox result projection', async () => {
  const fixture = await matchedProjection();
  try {
    expect(await fixture.stored()).toMatchObject({
      turn: '',
      white_ms: null,
      black_ms: null,
      clock_at_ms: null,
    });
    const deadlines = await fixture.db.query(
      sql<{
        available_at: string;
      }>`SELECT available_at FROM outbox_events WHERE type = ${MultiplayerDeadline.type}`
    );
    expect(deadlines).toHaveLength(1);
    expect(Date.parse(deadlines[0]!.available_at)).toBe(5_000);
  } finally {
    await fixture.dispose();
  }
});

test('SQL rollback after an authoritative result retries its receipt and rates both people once', async () => {
  const fixture = await matchedProjection();
  try {
    await fixture.rig.connect('alice');
    await fixture.rig.connect('bob');
    await fixture.rig.advance(65);
    expect(fixture.rig.match().outcome).toBe('white');
    const args = { gameId: 'race-1', requestId: 'same-projection' };
    await expect(
      fixture.db.transaction(async (tx) => {
        await synchronizeLiveMatchMutation.run(
          { tx: wrapMutationDb(tx, fixture.env).tx, env: fixture.env },
          args
        );
        throw new Error('injected rollback after the room committed');
      })
    ).rejects.toThrow('injected rollback');
    expect((await fixture.stored())?.outcome).toBe('ongoing');
    const project = () =>
      fixture.db.transaction(async (tx) =>
        synchronizeLiveMatchMutation.run(
          { tx: wrapMutationDb(tx, fixture.env).tx, env: fixture.env },
          args
        )
      );
    await project();
    await project();
    expect(await fixture.stored()).toMatchObject({
      outcome: 'white',
      reason: 'finish line',
      turn: '',
    });
    const ratings = await fixture.db.query(
      sql<{
        games: number;
      }>`SELECT games FROM chess_multiplayer_ratings ORDER BY owner_id`
    );
    expect(ratings.map((rating) => rating.games)).toEqual([1, 1]);
    const owners = await fixture.db.query(
      sql<{
        available: number;
      }>`SELECT available FROM matchmaking_owners ORDER BY id`
    );
    expect(owners.map((owner) => owner.available)).toEqual([1, 1]);
    expect(fixture.rig.errors).toEqual([]);
  } finally {
    await fixture.dispose();
  }
});

test('the existing deadline consumer projects a physics result without another player mutation', async () => {
  const fixture = await matchedProjection();
  try {
    await fixture.rig.connect('alice');
    await fixture.rig.connect('bob');
    await fixture.rig.advance(65);
    const notified = await fixture.db.transaction((tx) =>
      settleDueGame(
        tx,
        {
          gameId: 'race-1',
          nowMs: fixture.rig.clock.now(),
          createId: fixture.createId,
        },
        fixture.rules,
        fixture.rooms
      )
    );
    expect(notified).toEqual(['alice', 'bob']);
    expect((await fixture.stored())?.outcome).toBe('white');
  } finally {
    await fixture.dispose();
  }
});
