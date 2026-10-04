import { deleteProductHarnessSnapshots, listProductHarnessSnapshots, loadProductHarnessSnapshot, purgeIncompatibleProductHarnessSnapshotsFromStore, saveProductHarnessSnapshot } from './product-harness-snapshots';
import type { SnapshotSessionCtx } from './product-harness-snapshots';
import { readEmbeddedHref } from '@libs/app-shared/embedded-href';
import { ensureActor, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { openSettings } from '@libs/harness/shell-actions';
import { assert } from '@pkgs/assert-shared/singleton';
import type { useProductHarnessSnapshots } from '@pkgs/harness-console-client/use-product-harness-snapshots';
import { useSnapshotChromeState } from '@pkgs/harness-console-client/use-snapshot-chrome-state';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-shared/helpers';
import { createRoot, createSignal } from 'solid-js';
import { tools } from './developer-tools-state';

async function snapshotContext(s: ProductHarness): Promise<SnapshotSessionCtx> {
  const lives = new Map(
    await Promise.all(
      [...s.actors.keys()].map(
        async (id) => [id, await s.harness.spawnClient(id)] as const
      )
    )
  );
  let paused = false;
  return {
    store: tools(s).snapshotStore,
    harness: s.harness,
    clock: s.harness.clock,
    scheduler: s.harness.scheduler,
    serverHandle: s.harness.serverSql,
    clientSqlByAddress: new Map(),
    maps: { clients: s.actors, lives },
    getClockPaused: () => paused,
    setClockPaused: (value) => {
      paused = value;
    },
    spawnClient: async (id) => {
      if (id === undefined) throw new Error('Checkpoint device missing');
      await ensureActor(s, id);
      return { id };
    },
    detachClientsForSnapshotLoad: async () => {
      for (const id of [...s.actors.keys()]) await s.runtime.restartActor(id);
    },
    refreshServers: () => {
      /* The harness fleet map is authoritative; there is no separate console map. */
    },
    notify: () => {
      /* Actor reads use the live map without a chrome subscriber. */
    },
    endSnapshotRestoring: () => {
      /* This host has no sticky autosave to resume. */
    },
    runQuiet: (fn) => fn(),
  };
}
async function refreshCheckpoints(s: ProductHarness) {
  const state = tools(s);
  state.snapshots = await listProductHarnessSnapshots(state.snapshotStore);
  return state.snapshots;
}
function checkpointChrome(s: ProductHarness) {
  const state = tools(s);
  if (state.snapshotChrome !== null) return state.snapshotChrome;
  return createRoot((dispose) => {
    state.disposeChrome = dispose;
    s.session.onDispose(dispose);
    const [snapshots, setSnapshots] = createSignal(state.snapshots);
    const refresh = async () => {
      const list = await refreshCheckpoints(s);
      setSnapshots(list);
      return list;
    };
    const list: ReturnType<typeof useProductHarnessSnapshots> = {
      get snaps() {
        return snapshots();
      },
      busy: false,
      error: null,
      refresh,
      onSave: () => Promise.reject(new Error('Named save required')),
      onLoad: async (id) => {
        await loadProductHarnessSnapshot(await snapshotContext(s), id);
      },
      onDelete: async (id) => {
        await deleteProductHarnessSnapshots(state.snapshotStore, [id]);
        await refresh();
      },
      onDeleteMany: async (ids) => {
        await deleteProductHarnessSnapshots(state.snapshotStore, ids);
        await refresh();
      },
      onPurgeIncompatible: async () => {
        const count = await purgeIncompatibleProductHarnessSnapshotsFromStore(
          state.snapshotStore
        );
        await refresh();
        return count;
      },
    };
    state.snapshotChrome = useSnapshotChromeState(list);
    return state.snapshotChrome;
  });
}
export const investigatePeople = scenarioAction({
  name: 'investigatePeople',
  act: async (s) => {
    await ensureActor(s, 'alice');
    await ensureActor(s, 'bob');
    await Promise.resolve(openSettings.act(s, 'alice'));
  },
});
export const saveCheckpoint = scenarioAction({
  name: 'saveCheckpoint',
  act: async (s, label: string, incompatible = false) => {
    const state = tools(s);
    for (const [id, actor] of s.actors)
      state.beforeApps.set(id, await actor.currentPath());
    const saved = await saveProductHarnessSnapshot(
      await snapshotContext(s),
      label
    );
    if (incompatible) {
      const key = `snapshots/${saved.id}/manifest.json`;
      const raw = await readUtf8(state.snapshotStore, key);
      if (raw === null) throw new Error('Saved manifest missing');
      const manifest = JSON.parse(raw) as { localSchemaVersion: number };
      manifest.localSchemaVersion--;
      await writeUtf8(
        state.snapshotStore,
        key,
        JSON.stringify(manifest),
        'application/json'
      );
    }
    await refreshCheckpoints(s);
  },
});
export const changeInvestigatedApp = scenarioAction({
  name: 'changeInvestigatedApp',
  act: async (s) => {
    await ensureActor(s, 'alice');
    const actor = s.actors.get('alice');
    assert.defined(actor, 'Alice missing');
    await actor.openLink('/');
  },
});
export const checkpointOperation = scenarioAction({
  name: 'checkpointOperation',
  act: async (s, op: string, label?: string) => {
    const state = tools(s);
    const chrome = checkpointChrome(s);
    const chosen =
      label === undefined
        ? undefined
        : state.snapshots.find((snapshot) => snapshot.label === label);
    if (label !== undefined && chosen === undefined)
      throw new Error('Checkpoint unavailable');
    if (['select', 'delete', 'restore'].includes(op))
      assert.defined(chosen, 'Checkpoint unavailable');
    const chosenId = chosen?.id;
    if (op === 'select') chrome.setSelectedId(chosenId ?? null);
    else if (op === 'delete')
      chrome.setPendingDeleteIds(chosenId === undefined ? null : [chosenId]);
    else if (op === 'confirm-delete') await chrome.runDelete();
    else if (op === 'cancel-delete') chrome.closeDelete();
    else if (op === 'purge') {
      chrome.setPurgeOpen(true);
      await chrome.runPurge();
    } else if (op === 'restore') {
      assert.defined(chosenId, 'Checkpoint unavailable');
      await loadProductHarnessSnapshot(await snapshotContext(s), chosenId);
    } else throw new Error('Unknown checkpoint operation');
  },
});
export const checkpointChoices = (s: ProductHarness) =>
  listProductHarnessSnapshots(tools(s).snapshotStore);
export const checkpointCanRestore = (s: ProductHarness) =>
  tools(s).snapshotChrome?.hasCompatibleSelection ?? false;
export async function restoredApps(s: ProductHarness) {
  const result = [];
  for (const [id, path] of tools(s).beforeApps) {
    await ensureActor(s, id);
    const actor = s.actors.get(id);
    assert.defined(actor, 'Checkpoint actor missing');
    const live = await s.harness.spawnClient(id);
    result.push({
      id,
      saved: path,
      shown: await actor.currentPath(),
      stored: await readEmbeddedHref(live.env.kv),
    });
  }
  return result;
}
