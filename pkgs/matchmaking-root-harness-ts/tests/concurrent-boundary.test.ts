import { describe, expect, test } from 'bun:test';
import type { MatchmakingHarnessBackend } from '@pkgs/matchmaking-root-harness-ts/api';
import {
  exampleAppSchema,
  NameAttr,
  RatingAttr,
  ratingWithin,
} from '@pkgs/matchmaking-root-harness-ts/attrs';
import { openHarnessStore } from '@pkgs/matchmaking-root-harness-ts/store';
import type { MatchmakingImplSqlOptions } from '@pkgs/matchmaking-sql-server-ts/matchmaking';
import { MatchmakingImplSql } from '@pkgs/matchmaking-sql-server-ts/matchmaking';

const begin = (ownerId: string, requestId: string) => ({
  ownerId,
  requestId,
  data: { ...NameAttr(ownerId), ...RatingAttr(1000) },
  formulas: [ratingWithin(50)],
});

async function adapters(
  backend: MatchmakingHarnessBackend,
  ports: Pick<MatchmakingImplSqlOptions, 'onFormed' | 'restrictionsFor'> = {}
) {
  const store = await openHarnessStore(backend);
  let nextId = 0;
  const replicas = Array.from(
    { length: 3 },
    () =>
      new MatchmakingImplSql({
        sqlClient: store.openClient(),
        schema: exampleAppSchema(),
        tuning: {
          now: () => 1700000000000,
          createId: () => `match-${String(++nextId)}`,
        },
        ...ports,
      })
  );
  await Promise.all(replicas.map((r) => r.ready()));
  return {
    replicas,
    async [Symbol.asyncDispose]() {
      await store.close();
    },
  };
}

for (const backend of ['sqlite', 'postgres-live'] as const)
  describe(backend, () => {
    // regression: matchmaking-serialization-conflict-refuses-begin
    // regression: matchmaking-concurrent-postgres-boot
    // regression: matchmaking-postgres-scope-overwritten
    test('simultaneous begins on three replicas retain one owner and original receipts', async () => {
      await using lobby = await adapters(backend);
      const requests = ['phone-1', 'computer-1', 'phone-1'];
      const answers = await Promise.all(
        lobby.replicas.map((r, at) => r.join(begin('alice', requests[at]!)))
      );
      expect(new Set(answers.map((r) => r.participantId)).size).toBe(1);
      for (const [at, requestId] of requests.entries())
        expect(
          await lobby.replicas[at]!.join(begin('alice', requestId))
        ).toEqual(answers[at]!);
    });

    test('competing formation passes share no search and deliver each complete group once', async () => {
      const handed: string[][] = [];
      await using lobby = await adapters(backend, {
        onFormed: async (_tx, fact) => {
          handed.push(fact.participants.map((p) => p.ownerId));
        },
      });
      for (const person of ['alice', 'bob', 'carol', 'dave'])
        await lobby.replicas[0]!.join(begin(person, `${person}-1`));
      const results = await Promise.all(lobby.replicas.map((r) => r.tick()));
      expect(results.reduce((n, r) => n + r.matches, 0)).toBe(2);
      expect(handed).toHaveLength(2);
      expect(new Set(handed.flat()).size).toBe(4);
      for (const person of ['alice', 'bob', 'carol', 'dave']) {
        const views = await Promise.all(
          lobby.replicas.map((r) => r.current(person))
        );
        expect(views[0]?.result?.status).toBe('matched');
        expect(views[1]).toEqual(views[0]);
        expect(views[2]).toEqual(views[0]);
      }
    });

    test('a failed consuming handoff rolls both searches back to waiting', async () => {
      await using lobby = await adapters(backend, {
        onFormed: async () => {
          throw new Error('handoff refused');
        },
      });
      await lobby.replicas[0]!.join(begin('alice', 'alice-1'));
      await lobby.replicas[1]!.join(begin('bob', 'bob-1'));
      await expect(lobby.replicas[2]!.tick()).rejects.toThrow(
        'handoff refused'
      );
      for (const replica of lobby.replicas)
        for (const person of ['alice', 'bob'])
          expect((await replica.current(person))?.result?.status).toBe(
            'waiting'
          );
    });

    test('authoritative consumer restrictions apply to observation and formation', async () => {
      await using lobby = await adapters(backend, {
        restrictionsFor: async () => [['alice', 'bob']],
      });
      await lobby.replicas[0]!.join(begin('alice', 'alice-1'));
      await lobby.replicas[1]!.join(begin('bob', 'bob-1'));
      expect(await lobby.replicas[2]!.canPair('alice', 'bob')).toBe(false);
      expect((await lobby.replicas[2]!.tick()).matches).toBe(0);
    });
  });

// regression: matchmaking-uncommitted-handoff-visible
// SQLite readers sharing the connection must not publish the match while its
// consuming handoff is suspended and will fail.
test('a suspended handoff never publishes an uncommitted match', async () => {
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const pause = new Promise<void>((resolve) => {
    release = resolve;
  });
  await using lobby = await adapters('sqlite', {
    onFormed: async () => {
      entered();
      await pause;
      throw new Error('handoff refused');
    },
  });
  await lobby.replicas[0]!.join(begin('alice', 'alice-1'));
  await lobby.replicas[1]!.join(begin('bob', 'bob-1'));
  const formation = lobby.replicas[0]!.tick().catch((cause: unknown) => cause);
  await started;
  let published: string | undefined;
  const reading = lobby.replicas[1]!.current('alice').then((view) => {
    published = view?.result?.status;
  });
  try {
    // Drain the deterministic promise continuations while the transaction is paused.
    for (let at = 0; at < 32; at++) await Promise.resolve();
    expect(published).not.toBe('matched');
  } finally {
    release();
  }
  expect(await formation).toBeInstanceOf(Error);
  await reading;
  expect(published).toBe('waiting');
});
