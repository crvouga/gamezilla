import { ClientConfigKey } from '@libs/app-config-shared-ts/client-config-keys';
import {
  CASE_NOW_MS,
  DMN_INPUT,
  type Person,
} from '@libs/permissions-shared-ts/people';
import type { AppGrantKey } from '@libs/permissions-shared-ts/permission-catalog';
import { DEFAULT_PERMISSION_POLICY } from '@libs/permissions-shared-ts/permission-policy';
import {
  type AppPolicy,
  mutationEnvFor,
  openConformanceDb,
  seedAccess,
} from '@libs/permissions-shared-ts/world';
import { defineTable } from '@pkgs/db-schema-root-shared-ts/define-table';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';

const billing = defineTable({
  domain: 'billing',
  name: 'billing_subscriptions',
  columns: {
    account_id: 'text',
    provider: 'text',
    provider_subscription_id: 'text',
    price_key: 'text',
    status: 'text',
    current_period_end: 'timestamp',
    cancel_at_period_end: 'boolean',
  },
});

export function snapshotPolicy(denied: readonly AppGrantKey[]): AppPolicy {
  return {
    ...DEFAULT_PERMISSION_POLICY,
    version: 'current',
    activeFromMs: CASE_NOW_MS,
    restrictions: {
      ...DEFAULT_PERMISSION_POLICY.restrictions,
      testRestriction: { when: 'always', deny: denied, reason: 'restricted' },
    },
    history: [
      { ...DEFAULT_PERMISSION_POLICY, version: 'prior', activeFromMs: 0 },
    ],
  };
}

export async function snapshotWorld(input: {
  readonly person: Person;
  readonly payments: boolean;
  readonly atMs: number;
  readonly policy: AppPolicy;
}) {
  const db = await openConformanceDb([billing]);
  await seedAccess(db, {
    input: {
      [DMN_INPUT.who]: input.person,
      [DMN_INPUT.payments]: input.payments ? 'yes' : 'no',
    },
    nowMs: input.atMs,
    policy: input.policy,
  });
  return { db, env: mutationEnvFor(input.person, input.atMs) };
}

export async function replaceSnapshotPolicy(
  db: SqlClient,
  policy: AppPolicy
): Promise<void> {
  await db.run(
    sql`UPDATE client_config SET value = ${JSON.stringify(policy)} WHERE id = ${ClientConfigKey.permissionPolicy}`
  );
}

export async function refusal(run: () => unknown): Promise<unknown> {
  try {
    await run();
    return null;
  } catch (error) {
    if (!(error instanceof MutationError)) throw error;
    return { code: error.code, message: error.message, meta: error.meta };
  }
}
