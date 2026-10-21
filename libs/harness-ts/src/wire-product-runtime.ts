/**
 * Default {@link ProductRuntime}: launch / reset / dispose actors on the
 * host UI. `openHarness` may replace this with a recording-aware wrapper.
 */

import type { HarnessSystemSnapshot } from '@pkgs/harness-console-shared-ts/system-snapshot';
import type { StepRecorder } from '@pkgs/ui-testing-root-shared-ts/step-recorder';
import {
  type ActorBrowserStorage,
  createActorBrowserStorage,
  damageActorBrowserStorage,
} from './actor-browser-storage';
import type { ProductHarness, ProductRuntime } from './harness';
import { productExtra } from './harness';
import { actorEmail } from './identity';
import type { ActorEntry } from './launch-actor';
import { closeActorEntry, launchActor } from './launch-actor';
import { ensureStackIdpAccounts } from './stack-idp-accounts';

export type WireProductRuntimeOptions = {
  readonly snapshot?: HarnessSystemSnapshot;
  readonly recorder?: StepRecorder | null;
  readonly onDispose?: () => Promise<void>;
};

/**
 * Install `surface.runtime` so `spawnActor` / explore work without `openHarness`.
 * Returns the live entry map for hosts that need extra teardown (HTTP listener).
 */
export function wireProductRuntime(
  surface: ProductHarness,
  options?: WireProductRuntimeOptions
): { readonly entries: Map<string, ActorEntry> } {
  const entries = new Map<string, ActorEntry>();
  const browserDevices = new Map<string, ActorBrowserStorage>();
  const damagedBrowserDevices = new Set<string>();
  const extra = productExtra(surface);
  const runtime: ProductRuntime = {
    async launchActor(id) {
      let browserStorage = browserDevices.get(id);
      if (extra.ui.kind === 'bun-webview' && browserStorage === undefined) {
        browserStorage = await createActorBrowserStorage(id);
        browserDevices.set(id, browserStorage);
      }
      if (extra.http.kind === 'stack') {
        await ensureStackIdpAccounts({
          idpOrigins: extra.http.idpOrigins,
          actorId: id,
          email: actorEmail(surface, id),
        });
      }
      const entry = await launchActor({
        ui: extra.ui,
        harness: surface.harness,
        id,
        ...(browserStorage === undefined ? {} : { browserStorage }),
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
      await surface.harness.dropClient(id);
      const storage = browserDevices.get(id);
      if (storage !== undefined && damagedBrowserDevices.delete(id)) {
        await damageActorBrowserStorage(storage);
      }
    },
    damageDeviceData(id) {
      surface.harness.damageDeviceData(id);
      if (browserDevices.has(id)) damagedBrowserDevices.add(id);
      return Promise.resolve();
    },
    async resetActor(id) {
      const existing = entries.get(id);
      if (existing !== undefined) {
        await closeActorEntry(existing);
        entries.delete(id);
      }
      surface.actors.delete(id);
      await surface.harness.dropClient(id);
      surface.harness.bumpClientEpoch();
      await browserDevices.get(id)?.cleanup();
      browserDevices.delete(id);
    },
    async disposeResources() {
      for (const entry of entries.values()) {
        await closeActorEntry(entry);
      }
      entries.clear();
      for (const storage of browserDevices.values()) await storage.cleanup();
      browserDevices.clear();
      if (extra.ui.kind === 'solid-dom') {
        extra.ui.session?.dispose();
      }
      await surface.harness.dispose();
      if (options?.onDispose !== undefined) {
        await options.onDispose();
      }
    },
  };
  surface.runtime = runtime;
  return { entries };
}
