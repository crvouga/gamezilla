import { publishInventory } from '@crvouga/atlas/reports/spec-inventory';
import type { ObjectStore } from '@pkgs/object-store-root-shared/interface';
import { readCommittedSpecs } from './committed-specs';

export async function publishCheckoutInventory(
  store: ObjectStore,
  repoRoot: string,
  sha: string
): Promise<void> {
  await publishInventory(store, {
    sha,
    documents: readCommittedSpecs(repoRoot, sha),
  });
}
