import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import { applyBatch } from './apply-batch';
import type { TablePolicyRegistry } from './apply-batch';
import type { UploadAuth } from '../shared/rules-auth';
import type { UploadBatch } from '../shared/upload-batch';

export type RunRulesFn = (args: {
  readonly phase: 'before' | 'after';
  readonly auth: UploadAuth;
  readonly batch: UploadBatch;
  readonly db: Pick<SqlClient, 'query'>;
}) => Promise<void>;

async function acquireUploadAdvisoryLock(
  tx: SqlClient,
  lockUserId: string
): Promise<void> {
  try {
    // Bind lockUserId as a parameter (not an identifier) so UUIDs / hyphens work.
    await tx.run(sql`SELECT pg_advisory_xact_lock(hashtext(${lockUserId}))`);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (
      message.includes('no such function') ||
      message.includes('pg_advisory_xact_lock') ||
      message.includes('hashtext')
    ) {
      return;
    }
    throw e;
  }
}

export async function processUploadWithRules(options: {
  readonly db: SqlClient;
  readonly auth: UploadAuth;
  readonly batch: UploadBatch;
  readonly policies: TablePolicyRegistry;
  readonly runRules: RunRulesFn;
  readonly lockUserId: string;
}): Promise<'accepted'> {
  const { db, auth, batch, policies, runRules, lockUserId } = options;

  await db.transaction(async (tx) => {
    await acquireUploadAdvisoryLock(tx, lockUserId);
    await runRules({ phase: 'before', auth, batch, db: tx });
    await applyBatch(tx, auth, batch, policies);
    await runRules({ phase: 'after', auth, batch, db: tx });
  });

  return 'accepted';
}
