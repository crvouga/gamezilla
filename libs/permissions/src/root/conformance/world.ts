/**
 * One decision case's server world: a fresh in-memory SQLite database with
 * the permission system's tables, the synced client config and whatever
 * feature tables the operation needs, seeded with what the server reads to
 * decide — the deployment's billing switch, the policy row when a case runs a
 * changed policy, and the membership rows behind a Plus member.
 *
 * For tests and spec bindings only (a `root/` export).
 */

import { ClientConfigKey } from '@libs/client-config/public/client-config-keys';
import { CLIENT_CONFIG_TABLES } from '@libs/client-config/public/schema';
import { registerTables, type TableDef } from '@pkgs/db-schema';
import { applySqliteSchema } from '@pkgs/db-schema-sqlite';
import type { PermissionPolicy } from '@pkgs/permissions';
import { raw, sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';
import type { MutationEnv } from '@pkgs/sync-engine/shared';

import type { AppLimit, AppPolicyKey } from '../../shared/permission-catalog';
import { PERMISSIONS_TABLES } from '../../shared/schema/tables';
import {
  type CaseInput,
  identityFor,
  membershipRowsFor,
  type Person,
  paymentsOfferedOf,
  personOf,
} from './people';

export type AppPolicy = PermissionPolicy<AppPolicyKey, AppLimit>;

/** A fixed stamp for rows seeded before the case happens. */
const SEEDED_AT = '2026-01-01T00:00:00.000Z';

function uniqueTables(tables: readonly TableDef[]): readonly TableDef[] {
  const byName = new Map<string, TableDef>();
  for (const table of [
    ...PERMISSIONS_TABLES,
    ...CLIENT_CONFIG_TABLES,
    ...tables,
  ]) {
    byName.set(table.name, table);
  }
  return [...byName.values()];
}

/** A fresh database with the permission tables plus `tables`. */
export async function openConformanceDb(
  tables: readonly TableDef[]
): Promise<SqlClient> {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await applySqliteSchema(db, registerTables(uniqueTables(tables)), {
    ownership: 'declared-only',
  });
  return db;
}

async function insertConfig(
  db: SqlClient,
  row: { readonly id: string; readonly value: unknown }
): Promise<void> {
  await db.run(sql`
    INSERT INTO client_config (id, value, created_at, updated_at, deleted_at)
    VALUES (${row.id}, ${JSON.stringify(row.value)}, ${SEEDED_AT},
      ${SEEDED_AT}, ${null})
  `);
}

async function insertMemberships(
  db: SqlClient,
  args: { readonly person: Person; readonly nowMs: number }
): Promise<void> {
  const accountId = identityFor(args.person).accountId;
  const rows = membershipRowsFor(args.person, args.nowMs);
  for (const [index, row] of rows.entries()) {
    await db.run(sql`
      INSERT INTO billing_subscriptions (
        id, account_id, provider, provider_subscription_id, price_key,
        status, current_period_end, cancel_at_period_end,
        created_at, updated_at, deleted_at
      ) VALUES (
        ${`membership-${String(index)}`}, ${accountId}, ${'conformance'},
        ${`subscription-${String(index)}`}, ${'subscription_monthly'},
        ${row.status}, ${row.current_period_end}, ${row.cancel_at_period_end},
        ${SEEDED_AT}, ${SEEDED_AT}, ${null}
      )
    `);
  }
}

/**
 * What the server reads to decide the case: the billing switch, the policy
 * row (only when the case runs a changed policy — otherwise the shipped one
 * applies, as on a server with no synced row), the person's memberships.
 */
export async function seedAccess(
  db: SqlClient,
  args: {
    readonly input: CaseInput;
    readonly nowMs: number;
    readonly policy?: AppPolicy | undefined;
  }
): Promise<void> {
  await insertConfig(db, {
    id: ClientConfigKey.billingEnabled,
    value: paymentsOfferedOf(args.input),
  });
  if (args.policy !== undefined) {
    await insertConfig(db, {
      id: ClientConfigKey.permissionPolicy,
      value: args.policy,
    });
  }
  await insertMemberships(db, {
    person: personOf(args.input),
    nowMs: args.nowMs,
  });
}

let mintedIds = 0;

/** The replay env of the person's device, at `nowMs` on both clocks. */
export function mutationEnvFor(person: Person, nowMs: number): MutationEnv {
  const identity = identityFor(person);
  return {
    ...identity,
    deviceId: 'conformance-device',
    now: () => new Date(nowMs),
    serverNow: () => new Date(nowMs),
    createId: () => `conformance-id-${String(++mintedIds)}`,
  };
}

/**
 * Every stored row of every table the world has, as one comparable string: a
 * refused operation must leave it exactly as it was.
 */
export async function storedRows(
  db: SqlClient,
  tables: readonly TableDef[]
): Promise<string> {
  const out: Record<string, unknown> = {};
  for (const { name } of uniqueTables(tables)) {
    out[name] = await db.query(
      sql<
        Record<string, unknown>
      >`SELECT * FROM ${raw(`"${name}"`)} ORDER BY id`
    );
  }
  return JSON.stringify(out);
}
