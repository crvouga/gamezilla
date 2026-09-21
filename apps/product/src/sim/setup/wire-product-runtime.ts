/**
 * Default {@link ProductRuntime}: launch / reset / dispose actors on the
 * host UI. `openSim` may replace this with a recording-aware wrapper.
 */

import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import type { StepRecorder } from '@pkgs/ui-testing';

import {
  type ActorEntry,
  closeActorEntry,
  launchActor,
} from '../actors/launch-actor';
import { actorEmail } from '../system/identity';
import {
  type ProductRuntime,
  type ProductSim,
  productExtra,
} from '../system/sim';
import { ensureStackIdpAccount } from './stack-idp-accounts';

export type WireProductRuntimeOptions = {
  readonly snapshot?: SimSystemSnapshot;
  readonly recorder?: StepRecorder | null;
  readonly onDispose?: () => Promise<void>;
};

/**
 * Install `surface.runtime` so `spawnActor` / explore work without `openSim`.
 * Returns the live entry map for hosts that need extra teardown (HTTP listener).
 */
export function wireProductRuntime(
  surface: ProductSim,
  options?: WireProductRuntimeOptions
): { readonly entries: Map<string, ActorEntry> } {
  const entries = new Map<string, ActorEntry>();
  const extra = productExtra(surface);
  const runtime: ProductRuntime = {
    async launchActor(id) {
      if (extra.http.kind === 'stack') {
        await ensureStackIdpAccount({
          idpOrigin: extra.http.idpOrigin,
          actorId: id,
          email: actorEmail(surface, id),
        });
      }
      const entry = await launchActor({
        ui: extra.ui,
        sim: surface.sim,
        id,
        ...(options?.snapshot !== undefined
          ? { snapshot: options.snapshot }
          : {}),
        ...(options?.recorder != null ? { recorder: options.recorder } : {}),
      });
      entries.set(id, entry);
      return entry.handle;
    },
    /**
     * Kill the app and open it again on the same device: the UI and the live
     * client go away, the local database / secure storage namespace stay.
     */
    async restartActor(id) {
      const existing = entries.get(id);
      if (existing !== undefined) {
        await closeActorEntry(existing);
        entries.delete(id);
      }
      surface.actors.delete(id);
      await surface.sim.dropClient(id);
    },
    async resetActor(id) {
      const existing = entries.get(id);
      if (existing !== undefined) {
        await closeActorEntry(existing);
        entries.delete(id);
      }
      surface.actors.delete(id);
      await surface.sim.dropClient(id);
      surface.sim.bumpClientEpoch();
    },
    async disposeResources() {
      for (const entry of entries.values()) {
        await closeActorEntry(entry);
      }
      entries.clear();
      if (extra.ui.kind === 'solid-dom') {
        extra.ui.session?.dispose();
      }
      await surface.sim.dispose();
      if (options?.onDispose !== undefined) {
        await options.onDispose();
      }
    },
  };
  surface.runtime = runtime;
  return { entries };
}
