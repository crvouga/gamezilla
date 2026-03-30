import { assert } from '@gamezilla/shared/assert';
import { CiPlatform } from './ci-platform';
import type { Deployable } from './deployable';
import { PatchDbAppDeployable } from './deployable-patch-db-app';
import { WebAppDeployable } from './deployable-web-app';

export const createDeployRegistry = (
  platform: CiPlatform
): readonly Deployable[] => {
  const registry: readonly Deployable[] = [
    new WebAppDeployable(platform),
    new PatchDbAppDeployable(platform),
  ];
  assert.ok(registry.length > 0, 'DEPLOY_REGISTRY must not be empty');
  const ids = registry.map((d) => d.id);
  assert.equals(
    new Set(ids).size,
    ids.length,
    'DEPLOY_REGISTRY: duplicate deployable id'
  );
  return registry;
};
