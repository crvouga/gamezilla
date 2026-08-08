#!/usr/bin/env bun
import { assertChannelExhaustiveness } from '@pkgs/sync-engine/shared';
/**
 * Fail CI when a mutation writes a table a query hydrates but their
 * invalidates / channels topics do not overlap.
 *
 * Framework mutations are merged inside assertChannelExhaustiveness.
 */
import { APP_MUTATIONS } from '../../apps/api/src/sync/app-mutations';
import { APP_QUERIES } from '../../apps/api/src/sync/app-queries';

const mutations = Object.values(APP_MUTATIONS);
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
