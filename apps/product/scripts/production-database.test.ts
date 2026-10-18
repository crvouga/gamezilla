import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConnectionBill } from './database-link';
import {
  databaseVerdict,
  PRODUCTION_DATABASE,
  REQUEST_BUDGET,
} from './production-database';

const bill = (overrides: Partial<ConnectionBill>): ConnectionBill => ({
  id: 0,
  roundTrips: 10,
  heldMs: 0,
  longestHoldMs: 0,
  longestHoldRoundTrips: 5,
  waitedMs: 0,
  refused: false,
  statements: ['SELECT 1'],
  ...overrides,
});

const summary = (bills: ConnectionBill[], refused = 0) => ({
  connections: bills.length,
  peakSessions: 3,
  refused,
  bills,
});

test('the local pool is as large as the deployed one', () => {
  const module = readFileSync(
    join(
      import.meta.dir,
      '../../../libs/infra-shared/tofu/modules/database/main.tf'
    ),
    'utf8'
  );
  const limit = /origin_connection_limit\s*=\s*(\d+)/.exec(module)?.[1];
  expect(Number(limit)).toBe(PRODUCTION_DATABASE.sessions);
});

test('requests within budget pass', () => {
  expect(databaseVerdict(summary([bill({})])).ok).toBe(true);
});

test('a request that sends too many statements fails the run and names it', () => {
  const verdict = databaseVerdict(
    summary([
      bill({
        roundTrips: REQUEST_BUDGET.roundTrips + 1,
        statements: ['SET search_path', 'SELECT w.id FROM matchmaking_waiting'],
      }),
    ])
  );
  expect(verdict.ok).toBe(false);
  expect(verdict.violations[0]).toContain('matchmaking_waiting');
});

test('a transaction that keeps a session too long fails the run', () => {
  const verdict = databaseVerdict(
    summary([
      bill({ longestHoldRoundTrips: REQUEST_BUDGET.roundTripsInOneHold + 1 }),
    ])
  );
  expect(verdict.ok).toBe(false);
  expect(verdict.violations[0]).toContain('pooled session');
});

test('a request refused by the pool fails the run', () => {
  const verdict = databaseVerdict(summary([bill({ refused: true })], 1));
  expect(verdict.ok).toBe(false);
  expect(verdict.violations[0]).toContain('open slot in the pool');
});
