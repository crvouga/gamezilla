/**
 * Usernames through the real profile mutations on SQLite:
 *
 * - `ensureProfile` always bootstraps a valid, unique username.
 * - `claimUsername` is model-checked: random claims (valid, invalid, taken,
 *   case/whitespace variants, the other user's name) and clock ticks across
 *   the change cooldown, against a two-user reference model.
 */
import { Database } from 'bun:sqlite';
import { describe, expect, test } from 'bun:test';
import {
  createAppModeration,
  SHIPPED_TEAM_RULES,
} from '@libs/moderation-shared-ts/policy';
import { claimUsernameMutation } from '@libs/profile-shared-ts/claim-username-mutation';
import { ensureProfileMutation } from '@libs/profile-shared-ts/ensure-profile-mutation';
import { PROFILE_TABLES } from '@libs/profile-shared-ts/tables';
import type { UsernameValidationError } from '@libs/profile-shared-ts/username';
import {
  USERNAME_CHANGE_COOLDOWN_MS,
  validateUsername,
} from '@libs/profile-shared-ts/username';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server-ts/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationEnv } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { wrapMutationDb } from '@pkgs/sync-engine-shared-ts/wrap-mutation-db';
import fc from 'fast-check';

const moderation = createAppModeration(SHIPPED_TEAM_RULES);

const T0 = Date.parse('2026-09-01T00:00:00.000Z');
const USERS = ['u1', 'u2'] as const;
type User = (typeof USERS)[number];

async function openProfileDb(): Promise<SqlClient> {
  const db = new SqlClientImplBunSqlite(new Database(':memory:'));
  await reconcileSqliteSchema(db, registerTables(PROFILE_TABLES));
  return db;
}

function env(actorId: string, nowMs: number): MutationEnv {
  return {
    actorId,
    deviceId: `${actorId}-device`,
    accountId: actorId,
    isAnon: false,
    now: () => new Date(nowMs),
    createId: () => `${actorId}-${nowMs}`,
    contentRules: moderation,
  };
}

async function ensureProfile(db: SqlClient, actorId: string): Promise<void> {
  const mutationEnv = env(actorId, T0);
  const { tx } = wrapMutationDb(db, mutationEnv);
  await ensureProfileMutation.run({ tx, env: mutationEnv }, {});
}

async function claim(
  db: SqlClient,
  call: {
    readonly actorId: string;
    readonly nowMs: number;
    readonly raw: string;
  }
): Promise<string> {
  const mutationEnv = env(call.actorId, call.nowMs);
  const { tx } = wrapMutationDb(db, mutationEnv);
  try {
    await claimUsernameMutation.run(
      { tx, env: mutationEnv },
      { username: call.raw }
    );
    return 'ok';
  } catch (error) {
    if (error instanceof MutationError) return error.code;
    throw error;
  }
}

type ProfileRow = {
  readonly id: string;
  readonly username: string;
  readonly username_norm: string | null;
  readonly username_changed_at: string | null;
};

function readProfiles(db: SqlClient): Promise<readonly ProfileRow[]> {
  return db.query(sql<ProfileRow>`
    SELECT id, username, username_norm, username_changed_at
    FROM profile ORDER BY id
  `);
}

describe('ensureProfile username bootstrap', () => {
  test('always assigns a valid username, unique across profiles', async () => {
    await assertProperty(
      'bootstrap usernames valid + unique',
      fc.asyncProperty(
        fc.uniqueArray(fc.oneof(fc.uuid(), fc.string({ minLength: 1 })), {
          minLength: 1,
          maxLength: 6,
        }),
        async (actorIds) => {
          const db = await openProfileDb();
          for (const actorId of actorIds) await ensureProfile(db, actorId);
          const rows = await readProfiles(db);
          expect(rows).toHaveLength(actorIds.length);
          for (const row of rows) {
            expect(validateUsername(row.username, moderation)).toBeNull();
            expect(row.username_norm).toBe(row.username.toLowerCase());
          }
          const norms = new Set(rows.map((r) => r.username_norm));
          expect(norms.size).toBe(rows.length);
        }
      )
    );
  });
});

const VALIDATION_CODES: Record<UsernameValidationError, string> = {
  empty: 'USERNAME_EMPTY',
  too_short: 'USERNAME_TOO_SHORT',
  too_long: 'USERNAME_TOO_LONG',
  invalid_format: 'USERNAME_INVALID_FORMAT',
  blocked: 'USERNAME_BLOCKED',
};

type Held = { username: string; changedAtMs: number | null };
type Model = { nowMs: number; readonly held: Map<User, Held> };
type Real = { readonly db: SqlClient };

function other(user: User): User {
  return user === 'u1' ? 'u2' : 'u1';
}

/** The claim rules: validate, no-op on re-claim, cooldown, then uniqueness. */
function modelClaim(m: Model, user: User, raw: string): string {
  const name = raw.trim().toLowerCase();
  const invalid = validateUsername(name, moderation);
  if (invalid !== null) return VALIDATION_CODES[invalid];
  const mine = m.held.get(user) as Held;
  if (mine.username === name) return 'ok';
  if (
    mine.changedAtMs !== null &&
    m.nowMs - mine.changedAtMs < USERNAME_CHANGE_COOLDOWN_MS
  ) {
    return 'USERNAME_COOLDOWN';
  }
  const theirs = m.held.get(other(user)) as Held;
  if (theirs.username.toLowerCase() === name) return 'USERNAME_TAKEN';
  m.held.set(user, { username: name, changedAtMs: m.nowMs });
  return 'ok';
}

function modelRows(m: Model): readonly ProfileRow[] {
  return USERS.map((id) => {
    const held = m.held.get(id) as Held;
    return {
      id,
      username: held.username,
      username_norm: held.username.toLowerCase(),
      username_changed_at:
        held.changedAtMs === null
          ? null
          : new Date(held.changedAtMs).toISOString(),
    };
  });
}

/** `$other` resolves at run time to the other user's current name. */
const arbRaw = fc.oneof(
  fc.constantFrom(
    'alice',
    'Alice',
    '  bob ',
    'bob',
    'ab',
    'bad name',
    '$other'
  ),
  fc.constant('x'.repeat(33)),
  fc.stringMatching(/^[a-zA-Z0-9_]{3,8}$/)
);

const arbClaim = fc.tuple(fc.constantFrom(...USERS), arbRaw).map(
  ([user, raw]): fc.AsyncCommand<Model, Real> => ({
    check: () => true,
    toString: () => `claim(${user}, ${JSON.stringify(raw)})`,
    async run(m, real) {
      const resolved =
        raw === '$other'
          ? (m.held.get(other(user)) as Held).username.toUpperCase()
          : raw;
      const actual = await claim(real.db, {
        actorId: user,
        nowMs: m.nowMs,
        raw: resolved,
      });
      expect(actual).toBe(modelClaim(m, user, resolved));
      expect(await readProfiles(real.db)).toEqual(modelRows(m));
    },
  })
);

const arbTick = fc
  .constantFrom(0, USERNAME_CHANGE_COOLDOWN_MS - 1, USERNAME_CHANGE_COOLDOWN_MS)
  .map(
    (ms): fc.AsyncCommand<Model, Real> => ({
      check: () => true,
      toString: () => `tick(${ms})`,
      async run(m) {
        m.nowMs += ms;
      },
    })
  );

describe('claimUsername state machine', () => {
  test('real mutation agrees with the reference model', async () => {
    await assertProperty(
      'claimUsername = model',
      fc.asyncProperty(
        fc.commands([arbClaim, arbClaim, arbTick], { maxCommands: 25 }),
        async (commands) => {
          const db = await openProfileDb();
          for (const user of USERS) await ensureProfile(db, user);
          const held = new Map<User, Held>();
          for (const row of await readProfiles(db)) {
            held.set(row.id as User, {
              username: row.username,
              changedAtMs: null,
            });
          }
          await fc.asyncModelRun(
            () => ({ model: { nowMs: T0, held }, real: { db } }),
            commands
          );
        }
      )
    );
  });
});
