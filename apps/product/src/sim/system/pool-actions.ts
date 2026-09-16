/**
 * Explore / randomActions pool — `defineAction`s with `enabled` / `sample`.
 * Walk wrappers are separate from scripted scenario pins so restrictive
 * `enabled` gates never break `s.apply(openSettings, 'alice')`.
 */

import { Handles } from '@libs/test-ids';
import { type CatalogAction, defineAction, type Rng } from '@pkgs/sim';

import { partition, restoreNetwork, spawnActor } from './actions';
import { actorUi } from './actor-ui';
import { returnToTabs, signInWithDev } from './auth-actions';
import { pickId, readyActorIds, sampleReadyActorId } from './pool-support';
import {
  dropServerNode,
  partitionLoadBalancer,
  spawnServerNode,
} from './server-actions';
import { openSettings } from './shell-actions';
import type { ProductSim } from './sim';

async function actorsWithNavBack(s: ProductSim): Promise<string[]> {
  const ids: string[] = [];
  for (const id of s.actors.keys()) {
    try {
      const ui = await actorUi(s, id);
      if (await ui.get(Handles.navBack).isVisible()) ids.push(id);
    } catch {
      // skip
    }
  }
  return ids;
}

/** Registered on the system; also listed in {@link PRODUCT_POOL_ACTIONS}. */
export const walkOpenSettings = defineAction({
  name: 'walkOpenSettings',
  enabled: async (s: ProductSim) => (await readyActorIds(s)).length > 0,
  sample: sampleReadyActorId,
  act: async (s: ProductSim, actorId: string) => {
    if (actorId === '') return;
    try {
      await Promise.resolve(openSettings.act(s, actorId));
    } catch {
      // Chrome moved between probe and act — walk continues.
    }
  },
});

export const walkReturnToTabs = defineAction({
  name: 'walkReturnToTabs',
  weight: 3,
  enabled: async (s: ProductSim) => (await actorsWithNavBack(s)).length > 0,
  sample: async (s: ProductSim) => {
    const ids = await actorsWithNavBack(s);
    return (rng: Rng) => pickId(ids, rng);
  },
  act: async (s: ProductSim, actorId: string) => {
    if (actorId === '') return;
    try {
      await Promise.resolve(returnToTabs.act(s, actorId));
    } catch {
      // Chrome moved between probe and act — walk continues.
    }
  },
});

export const walkOpenSpacesTab = defineAction({
  name: 'walkOpenSpacesTab',
  enabled: async (s: ProductSim) => (await readyActorIds(s)).length > 0,
  sample: sampleReadyActorId,
  act: async (s: ProductSim, actorId: string) => {
    if (actorId === '') return;
    try {
      const ui = await actorUi(s, actorId);
      if (!(await ui.get(Handles.tabSpaces).isVisible())) {
        if (await ui.get(Handles.navBack).isVisible()) {
          await ui.get(Handles.navBack).tap();
        }
      }
      if (!(await ui.get(Handles.tabSpaces).isVisible())) return;
      await ui.get(Handles.tabSpaces).tap();
    } catch {
      // Chrome moved between probe and act — walk continues.
    }
  },
});

export const walkSignInWithDev = defineAction({
  name: 'walkSignInWithDev',
  enabled: async (s: ProductSim) => (await readyActorIds(s)).length > 0,
  sample: sampleReadyActorId,
  act: async (s: ProductSim, actorId: string) => {
    if (actorId === '') return;
    try {
      await Promise.resolve(signInWithDev.act(s, actorId));
    } catch {
      // Already signed in or chrome moved — walk continues.
    }
  },
});

/** Walk-only actions to register alongside scenario pins. */
export const PRODUCT_WALK_ACTIONS = [
  walkOpenSettings,
  walkReturnToTabs,
  walkOpenSpacesTab,
  walkSignInWithDev,
] as const;

/**
 * Slice for `s.randomActions` / `system.explore`: topology + walk wrappers.
 */
export const PRODUCT_POOL_ACTIONS: readonly CatalogAction<ProductSim>[] = [
  spawnActor,
  partition,
  restoreNetwork,
  spawnServerNode,
  dropServerNode,
  partitionLoadBalancer,
  ...PRODUCT_WALK_ACTIONS,
];
