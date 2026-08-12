/**
 * SQL adapter conformance — same contract suite as in-memory, against PGlite.
 * Excluded from default `test` via `*.contract.test.ts` path ignore.
 */

import { describe } from 'bun:test';
import { PGlite } from '@electric-sql/pglite';
import { createPgliteSqlClient } from '@pkgs/sql-client/postgres/impl-pglite';
import {
  type BootOverrides,
  resolveConfig,
  runMatchmakingAppContractTests,
  runMatchmakingContractTests,
} from '../testing';
import { MatchmakingImplSql } from './matchmaking';

async function sqlFactory(overrides?: BootOverrides) {
  const db = await PGlite.create();
  const config = resolveConfig(overrides);
  const mm = new MatchmakingImplSql({
    ...config,
    sqlClient: createPgliteSqlClient(db),
  });
  await mm.ready();
  return mm;
}

describe('MatchmakingImplSql contract', () => {
  runMatchmakingContractTests(sqlFactory);
});

describe('MatchmakingImplSql app contract', () => {
  runMatchmakingAppContractTests(sqlFactory);
});
