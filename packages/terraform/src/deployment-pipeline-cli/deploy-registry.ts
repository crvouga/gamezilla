import { assert } from '@gamezilla/shared/assert';
import type { CiPlatform } from './ci-platform';
import type { Deployable } from './deployable';
import { WebAppDeployable } from './deployable-web-app';

export const createDeployRegistry = (
  platform: CiPlatform
): readonly Deployable[] => {
  const registry: readonly Deployable[] = [
    new WebAppDeployable(platform),
  ];
  assert.ok(registry.length > 0, 'DEPLOY_REGISTRY must not be empty');
  return registry;
};
