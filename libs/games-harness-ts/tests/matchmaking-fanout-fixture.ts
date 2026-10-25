import { joinMultiplayerSpace } from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import {
  givenGameSpace,
  openFindingAnOpponent,
  seekGameOpponent,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { offeredMatchChoices } from '@libs/game-matchmaking-shared-ts/match-choice';
import { gameSystem } from '@libs/game-session-harness-ts/game-system';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import type { OpenHarness } from '@libs/harness-ts/open-harness';
import type { ProductExtra } from '@libs/harness-ts/ports';
import { defineRuntime } from '@pkgs/harness-root-shared-ts/define-runtime';
import {
  getSystemRegistry,
  type SystemCore,
} from '@pkgs/harness-root-shared-ts/registry';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { SECRET_PICK_GAME } from './reference-game/secret-pick-game';

export const FANOUT_SYSTEM = gameSystem('matchmaking-fanout-cost', [
  SECRET_PICK_GAME,
]);
export const FANOUT_CONTROL = offeredMatchChoices(
  createTurnGames([SECRET_PICK_GAME.shared.registration])
).find(
  (choice) => choice.clock?.minutes === 5 && choice.clock.incrementSeconds === 0
)?.id;

export type Statement = {
  readonly text: string;
  readonly values: readonly unknown[];
};

function observedSql(
  db: SqlClient,
  observe: (query: Sql<unknown>) => void
): SqlClient {
  return {
    connect: () => db.connect(),
    disconnect: () => db.disconnect(),
    query: (query) => {
      observe(query);
      return db.query(query);
    },
    run: (query) => {
      observe(query);
      return db.run(query);
    },
    prepare: (query) => db.prepare(query),
    transaction: (fn) => db.transaction((tx) => fn(observedSql(tx, observe))),
  };
}

/** Decorate the existing runtime's injected server SQL before the actual app boots. */
export function observedServerRuntime(observe: (query: Sql<unknown>) => void) {
  // Registry lookup uses object identity; it never invokes the system's void-argument creator.
  const system = FANOUT_SYSTEM as SystemCore<ProductHarness, unknown>;
  const runtime = getSystemRegistry(system).runtimeEntries.find(
    (entry) => entry.name === 'in-process'
  );
  if (runtime === undefined) throw new Error('No in-process product runtime');
  return defineRuntime({
    name: 'observed-server-sql',
    create: async () =>
      (await runtime.create()).with((session) => {
        const extra = session.ports as typeof session.ports & ProductExtra;
        return {
          sql: {
            ...extra.sql,
            sqlClient: observedSql(extra.sql.sqlClient, observe),
          },
        };
      }),
  });
}

/** Both future participants and a guest in each hosted space, before the final Find. */
export async function prepareFanoutFind(s: OpenHarness): Promise<void> {
  if (FANOUT_CONTROL === undefined)
    throw new Error('No five-minute game clock');
  await s.apply(seekGameOpponent, 'alice', SECRET_PICK_GAME.shared.id, '5+0');
  await s.apply(signInWithGoogle, 'bob');
  await s.apply(givenGameSpace, 'bob');
  await s.apply(openFindingAnOpponent, 'bob', SECRET_PICK_GAME.shared.id);
  await s.apply(joinMultiplayerSpace, 'carol', 'alice');
  await s.apply(joinMultiplayerSpace, 'dave', 'bob');
  await s.read((world) => world.session.waitForIdle());
}
