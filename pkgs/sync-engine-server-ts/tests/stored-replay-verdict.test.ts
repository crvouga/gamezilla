import { expect, test } from 'bun:test';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import { storedReplayVerdict } from '@pkgs/sync-engine-server-ts/stored-replay-verdict';

const DECISION = {
  decision: {
    reason: 'requires_account',
    allowed: false,
    unlockRef: 'matchmaking:use#requires_account',
    policyVersion: '2026-10-23.1',
  },
};

function txReturning(meta: unknown): SqlTx {
  return {
    query: async () => [
      {
        status: 'rejected',
        code: 'requires_account',
        message: 'Permission denied: matchmaking:use',
        meta,
      },
    ],
  } as unknown as SqlTx;
}

// regression: stored-rejection-jsonb-meta-crash
// Literal input: the refusal Postgres stored for a repeated findChessOpponent;
// its jsonb `meta` column comes back as an object, not as text.
test('a repeated upload reads refusal details Postgres already parsed', async () => {
  expect(
    await storedReplayVerdict(txReturning(DECISION), 'find-opponent')
  ).toEqual({
    status: 'rejected',
    code: 'requires_account',
    message: 'Permission denied: matchmaking:use',
    meta: DECISION,
  });
});

test('a repeated upload reads refusal details stored as text', async () => {
  expect(
    await storedReplayVerdict(
      txReturning(JSON.stringify(DECISION)),
      'find-opponent'
    )
  ).toMatchObject({ status: 'rejected', meta: DECISION });
});
