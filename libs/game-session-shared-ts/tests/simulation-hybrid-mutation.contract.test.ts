import { expect, test } from 'bun:test';
import { playMultiplayerMoveMutation } from '@libs/game-matchmaking-shared-ts/play-multiplayer-move-mutation';
import type { MutationEnv } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';
import { hybridRaceGame, timedRaceCodec } from './reference-hybrid-race';
import { matchedProjection } from './reference-matched-projection';
import { requestState } from './reference-simulation-room';

type Fixture = Awaited<ReturnType<typeof matchedProjection>>;
type Move = Parameters<typeof playMultiplayerMoveMutation.run>[1];
function play(fixture: Fixture, args: Move, env: MutationEnv = fixture.env) {
  return fixture.db.transaction((tx) =>
    playMultiplayerMoveMutation.run(
      { tx: wrapMutationDb(tx, env).tx, env },
      args
    )
  );
}

// regression: hybrid-match-move-bypasses-live-authority
test('a hybrid mutation checks real permissions and retries an accepted room move after SQL rollback', async () => {
  const fixture = await matchedProjection(hybridRaceGame);
  try {
    const alice = await fixture.rig.connect('alice');
    await fixture.rig.connect('bob');
    await fixture.rig.advance(3);
    expect((await fixture.stored())?.revision).toBe(0);
    expect(fixture.rig.match().revision).toBe(3);
    const args = {
      gameId: 'race-1',
      spaceId: 'alice-space',
      requestId: 'hybrid-rollback',
      revision: 3,
      uci: 'advance-token',
    };
    await expect(
      fixture.db.transaction(async (tx) => {
        await playMultiplayerMoveMutation.run(
          { tx: wrapMutationDb(tx, fixture.env).tx, env: fixture.env },
          args
        );
        throw new Error('rollback after the hybrid authority accepted');
      })
    ).rejects.toThrow('rollback after the hybrid authority accepted');
    expect((await fixture.stored())?.pgn).toBe('');
    expect(
      timedRaceCodec.decode((await requestState(alice)).state)?.tokens
    ).toBe(1);
    await play(fixture, args);
    await play(fixture, args);
    expect(await fixture.stored()).toMatchObject({ pgn: '1', turn: 'bob' });
    expect(
      timedRaceCodec.decode((await requestState(alice)).state)?.tokens
    ).toBe(1);
    await play(
      fixture,
      {
        ...args,
        spaceId: 'bob-space',
        requestId: 'hybrid-second-turn',
        revision: fixture.rig.match().revision,
      },
      { ...fixture.env, actorId: 'bob', accountId: 'bob', deviceId: 'tablet' }
    );
    await fixture.rig.advance(4);
    const after = await requestState(alice);
    expect(timedRaceCodec.decode(after.state)?.tokens).toBe(2);
    expect(after.tick).toBe(7);
    expect(await fixture.stored()).toMatchObject({ pgn: '2', turn: 'alice' });
    expect(fixture.rig.errors).toEqual([]);
  } finally {
    await fixture.dispose();
  }
});
