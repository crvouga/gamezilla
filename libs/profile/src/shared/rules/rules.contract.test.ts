import { describe, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import type { AppRulesAuth } from '@libs/auth/shared/app-rules-auth';
import { isRulesReject } from '@pkgs/rules/core/rules-reject';
import { runRules } from '@pkgs/rules/core/run-rules';
import type { RulesCtx } from '@pkgs/rules/core/types';
import { PROFILE_ID_MISMATCH } from './codes';
import { PROFILE_RULES } from './rules';

const auth: AppRulesAuth = {
  userId: 'me',
  deviceId: 'd1',
  accountId: 'me',
  isAnon: false,
};

function queryOnlyFromBunSqlite(db: Database): Pick<RulesCtx['db'], 'query'> {
  return {
    query: async <T>(sqlQuery: {
      readonly sql: string;
      readonly values: readonly unknown[];
    }) => {
      const stmt = db.prepare(sqlQuery.sql);
      const bindings = sqlQuery.values as never[];
      return stmt.all(...bindings) as T[];
    },
  };
}

describe('profile rules contract (sqlite)', () => {
  test('before rejects foreign profile id', async () => {
    const db = new Database(':memory:');
    db.run(
      `CREATE TABLE profiles (id TEXT PRIMARY KEY, avatar_config TEXT, created_at TEXT)`
    );
    try {
      await runRules(
        {
          phase: 'before',
          auth,
          batch: {
            rows: [
              {
                op: 'patch',
                table: 'profiles',
                id: 'other',
                values: { avatar_config: '{}' },
              },
            ],
          },
          db: queryOnlyFromBunSqlite(db),
        },
        PROFILE_RULES
      );
      expect.unreachable('expected RulesReject');
    } catch (e) {
      expect(isRulesReject(e)).toBe(true);
      if (isRulesReject(e)) {
        expect(e.failures[0]?.code).toBe(PROFILE_ID_MISMATCH);
      }
    }
  });

  test('after accepts own profile patch', async () => {
    const db = new Database(':memory:');
    db.run(
      `CREATE TABLE profiles (id TEXT PRIMARY KEY, avatar_config TEXT, created_at TEXT)`
    );
    db.run(
      `INSERT INTO profiles (id, avatar_config, created_at) VALUES ('me', '{}', 't')`
    );
    await runRules(
      {
        phase: 'after',
        auth,
        batch: {
          rows: [
            {
              op: 'patch',
              table: 'profiles',
              id: 'me',
              values: { avatar_config: '{"x":1}' },
            },
          ],
        },
        db: queryOnlyFromBunSqlite(db),
      },
      PROFILE_RULES
    );
  });
});
