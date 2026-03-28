import assert from 'node:assert/strict';
import type { Deployable } from './deployable';
import { PatchDbAppDeployable } from './deployable-patch-db-app';
import { WebAppDeployable } from './deployable-web-app';

export const DEPLOY_REGISTRY: readonly Deployable[] = [
  new WebAppDeployable(),
  new PatchDbAppDeployable(),
];

assert(DEPLOY_REGISTRY.length > 0, 'DEPLOY_REGISTRY must not be empty');
const ids = DEPLOY_REGISTRY.map((d) => d.id);
assert.strictEqual(
  new Set(ids).size,
  ids.length,
  'DEPLOY_REGISTRY: duplicate deployable id'
);
