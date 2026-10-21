// @io-wall-ok — CLI entry: reads the built dist/ through the node-fs store.
/**
 * `bun run --filter @apps/product-ts verify:offline-shell` (after `build`):
 * fails when a file the wall client can load is missing from the service
 * worker's precache, or when the precache exceeds its budget. See the policy
 * and analysis in `sw-policy.ts`.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';

import { readOfflineShellInput } from './dist-graph';
import {
  analyzeOfflineShell,
  formatOfflineShellSummary,
  offlineShellFailures,
  PRECACHE_BUDGET_BYTES,
} from './sw-policy';

const distDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const store = createNodeFsObjectStore({
  rootDir: distDir,
  fs: wallNodeFs(),
  layout: 'tree',
});

const report = analyzeOfflineShell(await readOfflineShellInput(store));
const failures = offlineShellFailures(report, PRECACHE_BUDGET_BYTES);
process.stdout.write(
  `[offline-shell] ${formatOfflineShellSummary(report, PRECACHE_BUDGET_BYTES).replaceAll('\n', '\n[offline-shell] ')}\n`
);
if (failures.length > 0) {
  process.stderr.write(
    `[offline-shell] FAIL — the app would not open and work offline after first install:\n${failures.map((line) => `  - ${line}`).join('\n')}\n`
  );
  process.exit(1);
}
process.stdout.write(
  '[offline-shell] OK — every wall-client file is precached\n'
);
