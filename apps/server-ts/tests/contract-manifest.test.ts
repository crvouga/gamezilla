import { expect, test } from 'bun:test';
import {
  buildContractManifest,
  missingNames,
  readCommittedContractManifest,
} from '../scripts/contract-manifest';

const committed = readCommittedContractManifest();
const current = await buildContractManifest();

test('the manifest contains no obsolete query or mutation names', () => {
  // Removed APIs must not survive as stale manifest entries or migration shims.
  expect(missingNames(committed, current)).toEqual([]);
});

test('contract-manifest.json records every current name', () => {
  // Record them: bun run --filter @apps/server-ts contract:write
  expect(missingNames(current, committed)).toEqual([]);
});
