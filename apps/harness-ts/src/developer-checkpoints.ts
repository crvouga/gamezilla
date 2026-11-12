import type { Client } from '@libs/app-root-client-ts/create-client';
import { readEmbeddedHref } from '@libs/app-root-shared-ts/embedded-href';
import { ensureActor, scenarioAction } from '@libs/harness-ts/actor-ui';
import { browserClientCheckpoints } from '@libs/harness-ts/browser-client-checkpoints';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { productExtra } from '@libs/harness-ts/harness';
import { openSettings } from '@libs/harness-ts/shell-actions';
import { assert } from '@pkgs/assert-root-shared-ts/singleton';
import type { useProductHarnessSnapshots } from '@pkgs/harness-console-client-ts/use-product-harness-snapshots';
import { useSnapshotChromeState } from '@pkgs/harness-console-client-ts/use-snapshot-chrome-state';
import { readUtf8, writeUtf8 } from '@pkgs/object-store-root-shared-ts/helpers';
import { createRoot, createSignal } from 'solid-js';
import { tools } from './developer-tools-state';
import type { SnapshotSessionCtx } from './product-harness-snapshots';
import {
  deleteProductHarnessSnapshots,
  listProductHarnessSnapshots,
  loadProductHarnessSnapshot,
  purgeIncompatibleProductHarnessSnapshotsFromStore,
  saveProductHarnessSnapshot,
} from './product-harness-snapshots';

async function snapshotContext(s: ProductHarness): Promise<SnapshotSessionCtx> {
  const extra = productExtra(s);
  const lives = new Map<string, Client>();
  if (extra.ui.kind === 'solid-dom') {
    const clients = await Promise.all(
      [...s.actors.keys()].map(
        async (id) => [id, await s.harness.spawnClient(id)] as const
      )
    );
    for (const [id, live] of clients) lives.set(id, live);
  }
  let paused = false;
  return {
    ...(extra.checkpointSqlFormat === undefined
      ? {}
      : { checkpointSqlFormat: extra.checkpointSqlFormat }),
    ...(extra.ui.kind === 'bun-webview'
      ? { clientCheckpoints: browserClientCheckpoints(s) }
      : {}),
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
async function rememberKept(s: ProductHarness) {
  const state = tools(s);
  for (const [id, actor] of s.actors)
    state.keptApps.set(id, await actor.currentPath());
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
    const alice = s.actors.get('alice');
    assert.defined(alice, 'Alice missing');
    tools(s).firstWorldPath = await alice.currentPath();
    tools(s).restoreFailure = 'none';
    await rememberKept(s);
  },
});
/** The next save hits a store fault, so an unfinished save is not listed. */
export const interruptNextCheckpointSave = scenarioAction({
  name: 'interruptNextCheckpointSave',
  act: (s) => {
    tools(s).snapshotStore.armFault(new Error('checkpoint save interrupted'));
    return Promise.resolve();
  },
});
export const saveCheckpoint = scenarioAction({
  name: 'saveCheckpoint',
  act: async (s, label: string, incompatible = false) => {
    const state = tools(s);
    state.restoreFailure = 'none';
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
    state.checkpointApps.set(label, new Map(state.beforeApps));
    state.checkpointIds.set(label, saved.id);
    await rememberKept(s);
  },
});
export const changeInvestigatedApp = scenarioAction({
  name: 'changeInvestigatedApp',
  act: async (s) => {
    await ensureActor(s, 'alice');
    const actor = s.actors.get('alice');
    assert.defined(actor, 'Alice missing');
    await actor.openLink('/');
    tools(s).restoreFailure = 'none';
    await rememberKept(s);
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
        : state.snapshots.find(
            (snapshot) => snapshot.id === state.checkpointIds.get(label)
          );
    if (label !== undefined && chosen === undefined)
      throw new Error('Checkpoint unavailable');
    if (['select', 'delete', 'restore'].includes(op))
      assert.defined(chosen, 'Checkpoint unavailable');
    const chosenId = chosen?.id;
    if (op === 'select') chrome.setSelectedId(chosenId ?? null);
    else if (op === 'delete')
      chrome.setPendingDeleteIds(chosenId === undefined ? null : [chosenId]);
    else if (op === 'confirm-delete') {
      await chrome.runDelete();
      state.restoreFailure = 'none';
    } else if (op === 'cancel-delete') chrome.closeDelete();
    else if (op === 'purge') {
      chrome.setPurgeOpen(true);
      await chrome.runPurge();
    } else if (op === 'restore') {
      assert.defined(chosenId, 'Checkpoint unavailable');
      await loadProductHarnessSnapshot(await snapshotContext(s), chosenId);
    } else throw new Error('Unknown checkpoint operation');
  },
});
/** The next restore cannot finish, and the world the team had stays. */
export const failCheckpointRestore = scenarioAction({
  name: 'failCheckpointRestore',
  act: async (s, label: string) => {
    const state = tools(s);
    state.beforeRestoreApps = new Map();
    for (const [id, actor] of s.actors)
      state.beforeRestoreApps.set(id, await actor.currentPath());
    state.snapshotStore.armFault(new Error('checkpoint restore failed'));
    try {
      await loadProductHarnessSnapshot(
        await snapshotContext(s),
        snapshotId(state, label)
      );
      state.restoreFailure = 'none';
    } catch {
      state.restoreFailure = 'failed';
    }
  },
});
/** Close and open the testing tool on the world it kept. */
export const reopenTestingTool = scenarioAction({
  name: 'reopenTestingTool',
  act: async (s) => {
    const state = tools(s);
    const kept = new Map(state.keptApps);
    for (const id of [...s.actors.keys()]) await s.runtime.restartActor(id);
    for (const [id, path] of kept) {
      await ensureActor(s, id);
      const actor = s.actors.get(id);
      assert.defined(actor, 'Checkpoint actor missing');
      await actor.openLink(path);
    }
    state.restoreFailure = 'none';
  },
});
function snapshotId(state: ReturnType<typeof tools>, label: string): string {
  const chosen = state.snapshots.find(
    (snapshot) => snapshot.id === state.checkpointIds.get(label)
  );
  assert.defined(chosen, 'Checkpoint unavailable');
  return chosen.id;
}
export const checkpointChoices = (s: ProductHarness) =>
  listProductHarnessSnapshots(tools(s).snapshotStore);
export const checkpointCanRestore = (s: ProductHarness) =>
  tools(s).snapshotChrome?.hasCompatibleSelection ?? false;
export async function restoredApps(s: ProductHarness, label?: string) {
  const savedByActor =
    (label === undefined ? undefined : tools(s).checkpointApps.get(label)) ??
    tools(s).beforeApps;
  const result = [];
  for (const [id, path] of savedByActor) {
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
export const restoreFailureOf = (s: ProductHarness) => tools(s).restoreFailure;
export const stillBeforeRestore = (s: ProductHarness) =>
  appsMatch(s, tools(s).beforeRestoreApps);
export const stillKept = (s: ProductHarness) => appsMatch(s, tools(s).keptApps);
export async function sharedCheckpointView(s: ProductHarness, label: string) {
  const state = tools(s);
  const alice = s.actors.get('alice');
  const path = alice === undefined ? '' : await alice.currentPath();
  const choices = await checkpointChoices(s);
  return {
    world: path === state.firstWorldPath ? 'first' : 'later',
    failure: state.restoreFailure,
    available: choices.some(
      (choice) => choice.id === state.checkpointIds.get(label)
    ),
  };
}
export async function appsMatch(
  s: ProductHarness,
  savedByActor: ReadonlyMap<string, string>
) {
  for (const [id, path] of savedByActor) {
    await ensureActor(s, id);
    const actor = s.actors.get(id);
    assert.defined(actor, 'Checkpoint actor missing');
    if ((await actor.currentPath()) !== path) return false;
  }
  return savedByActor.size > 0;
}
