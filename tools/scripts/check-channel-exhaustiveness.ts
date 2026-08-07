#!/usr/bin/env bun
/**
 * Fail CI when a mutation writes a table a query hydrates but their
 * invalidates / channels topics do not overlap.
 */
import { APP_MUTATIONS } from '../../apps/api/src/sync/app-mutations';
import { APP_QUERIES } from '../../apps/api/src/sync/app-queries';
import { withFrameworkMutations } from '../../pkgs/sync-engine/src/mutations/shared/with-framework-mutations';
import { assertChannelExhaustiveness } from '../../pkgs/sync-engine/src/shared/channel-exhaustiveness';

const mutations = Object.values(withFrameworkMutations(APP_MUTATIONS));
const queries = Object.values(APP_QUERIES);

try {
  assertChannelExhaustiveness(mutations, queries);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

console.log(
  `ci:channel-exhaustiveness OK (${String(mutations.length)} mutations × ${String(queries.length)} queries)`
);
