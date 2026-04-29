import { createEntityDb } from '@gamezilla/lib/entity-db/factory';
import type { EntityDb } from '@gamezilla/lib/entity-db/interface';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';

/** Always treat incoming webhook payload as newer than any cached row. */
export const stripeWebhookCompareVersions = (): 1 => 1;

export function createStripeWebhookCacheEntityDb(
  sqlClient: SqlClient
): EntityDb {
  return createEntityDb({
    sqlClient,
    compareVersions: stripeWebhookCompareVersions,
  });
}
