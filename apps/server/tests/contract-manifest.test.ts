import { expect, test } from 'bun:test';
import {
  buildContractManifest,
  missingNames,
  readCommittedContractManifest,
} from '@apps/server/scripts/contract-manifest';

const committed = readCommittedContractManifest();
const current = await buildContractManifest();

test('no shipped query or mutation name is removed or renamed', () => {
  // A shipped client still uses these names; add a new name instead.
  expect(missingNames(committed, current)).toEqual([]);
});

test('contract-manifest.json records every current name', () => {
  // Record them: bun run --filter @apps/server contract:write
  expect(missingNames(current, committed)).toEqual([]);
});
