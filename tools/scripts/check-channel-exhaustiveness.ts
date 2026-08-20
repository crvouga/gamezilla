#!/usr/bin/env bun
import { appTopicMap } from '@libs/runtime/root/app-topic-map';
import { assertChannelExhaustiveness } from '@pkgs/sync-engine/shared';
/**
 * Fail CI when a query hydrates a table with no topic map entry
 * (unless reconcile-only). Hydrates are resolved via stub run.
 */
import { APP_QUERIES } from '../../apps/server/src/sync/app-queries';

const queries = Object.values(APP_QUERIES);

try {
  await assertChannelExhaustiveness(appTopicMap, queries);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
}

console.log(
  `ci:channel-exhaustiveness OK (${String(queries.length)} queries × topic map)`
);
