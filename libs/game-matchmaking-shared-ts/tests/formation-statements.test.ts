import { expect, test } from 'bun:test';
import { offeredMatchChoices } from '@libs/game-matchmaking-shared-ts/match-choice';
import { formGameMatches } from '@libs/game-matchmaking-shared-ts/match-handoff';
import { opponentPool } from '@libs/game-matchmaking-shared-ts/search-config';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import {
  createTurnGames,
  type RegisteredTurnGame,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { countingRules } from './counting-rules';

/**
 * Two games offering finding an opponent: the platform's durable game, whose
 * clock choices are unprefixed, and another in its own `<id>/` namespace.
 * Their finite counting rules have separate positions and clock namespaces.
 */
function game(id: string, unprefixed: boolean): RegisteredTurnGame {
  return {
    rules: countingRules(id),
    capabilities: {
      matchmaking: {
        clockChoices: true as const,
        namespace: unprefixed ? '' : `${id}/`,
        notice: {
          side: (side) => side,
          ending: () => undefined,
          timeoutDraw: () => 'drawn on time',
        },
      },
      history: { record: () => '' },
    },
    ...(unprefixed ? { unprefixedNamespace: true as const } : {}),
  };
}
const rules = createTurnGames([game('first', true), game('second', false)]);

/** A transaction that only counts statements, where each costs a database round trip. */
function recordingTx(waitingPools: readonly string[]) {
  const statements: string[] = [];
  const tx: SqlTx = {
    query: async (query) => {
      statements.push(query.sql);
      const poolsQuery =
        query.sql.includes('DISTINCT') &&
        query.sql.includes('matchmaking_waiting');
      return (
        poolsQuery
          ? waitingPools.map((partition_signature) => ({ partition_signature }))
          : []
      ) as never;
    },
    run: async (query) => {
      statements.push(query.sql);
      return { changes: 0, lastInsertRowid: 0 };
    },
  };
  const passes = () =>
    statements.filter((text) => text.includes('matchmaking_active_partitions'))
      .length;
  return { tx, statements, passes };
}

const ports = {
  nowMs: Date.parse('2026-10-01T00:00:00.000Z'),
  createId: () => 'id',
};

// regression: matchmaking-formation-pass-per-time-control
test('a formation pass costs nothing for time controls nobody is waiting in', async () => {
  expect(offeredMatchChoices(rules).length).toBeGreaterThanOrEqual(20);
  const idle = recordingTx([]);
  await formGameMatches(idle.tx, ports, rules);
  expect(idle.passes()).toBe(0);
  expect(idle.statements.length).toBeLessThanOrEqual(1);
});

test('a formation pass runs only for the pools that have people waiting', async () => {
  const waiting = recordingTx([
    opponentPool('5+0', rules),
    opponentPool('second/3+0', rules),
  ]);
  await formGameMatches(waiting.tx, ports, rules);
  expect(waiting.passes()).toBe(2);
});
