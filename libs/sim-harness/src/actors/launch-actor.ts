/**
 * Per-actor UI launch / teardown for the product system runtime.
 */

import { wallClock, wallTimers } from '@pkgs/clock';
import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import type { SqlTx } from '@pkgs/sql-client/interface';
import type { Driver, StepRecorder } from '@pkgs/ui-testing';
import { recordingDriver } from '@pkgs/ui-testing';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview';
import {
  createSolidDomDriver,
  type MultiAppSolidDomSession,
} from '@pkgs/ui-testing-solid-dom';
import { createMemoryHistory, type MemoryHistory } from '@solidjs/router';
import type { ProductUi, Sim, SimActor } from '..';
import { simClientNamespace } from '..';
import { createSimWaitPump } from '../setup/sim-wait-pump';
import { injectWebViewSnapshotAuth } from './inject-webview-snapshot-auth';
import { solidActorRoot } from './solid-actor-root';
import { webviewLocalSql } from './webview-local-sql';

export type ActorEntry = {
  readonly handle: SimActor;
  readonly raw: Driver;
  readonly closeResources: () => Promise<void>;
};

/**
 * Solid DOM driver for one in-process actor. Waits are pump-driven (the sim's
 * virtual `runFor`), deadlines run on the wall clock so virtual-time stepping
 * never eats the wait budget.
 */
async function createSolidDomClientDriver(args: {
  readonly sim: Sim;
  readonly id: string;
  readonly session: MultiAppSolidDomSession;
  readonly runFor: (durationMs: number) => Promise<void>;
  readonly history: MemoryHistory;
}): Promise<Driver> {
  const live = await args.sim.spawnClient(args.id);
  const pump = createSimWaitPump({
    scheduler: args.sim.scheduler,
    runFor: args.runFor,
  });
  return createSolidDomDriver({
    clock: wallClock,
    pump,
    harness: {
      mount: async () => {
        const app = args.session.mountActor(
          args.id,
          solidActorRoot(live, args.sim.browser(args.id), args.history)
        );
        await args.runFor(0);
        return app;
      },
    },
  });
}

export async function launchActor(args: {
  readonly ui: ProductUi;
  readonly sim: Sim;
  readonly id: string;
  readonly snapshot?: SimSystemSnapshot;
  /** When set, every driver op becomes a report step for this actor. */
  readonly recorder?: StepRecorder;
}): Promise<ActorEntry> {
  let raw: Driver;
  let localSql: () => SqlTx | null = () =>
    args.sim.clientSql(args.id)?.sqlClient ?? null;
  let closeResources: () => Promise<void> = () => Promise.resolve();
  let openLink: (path: string) => Promise<void>;
  let currentPath: () => Promise<string>;
  if (args.ui.kind === 'bun-webview') {
    const webOrigin = args.ui.webOrigin;
    // Each actor is its own device: its own on-disk storage (cookies, OPFS
    // for the app's SQLite), shared with the popups it opens. No URL here:
    // the driver's `launch` navigates and awaits the load.
    const { mkdtemp, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const directory = await mkdtemp(join(tmpdir(), `sim-webview-${args.id}-`));
    const dataStore = { directory };
    const view = new Bun.WebView({ width: 390, height: 844, dataStore });
    raw = new BunWebviewDriver({
      view,
      baseUrl: webOrigin,
      actorId: args.id,
      popupOptions: { dataStore },
      timers: wallTimers,
    });
    const pageSql = webviewLocalSql(view);
    localSql = () => pageSql;
    closeResources = async () => {
      view.close();
      await rm(directory, { recursive: true, force: true });
    };
    openLink = (path) => view.navigate(`${webOrigin}${path}`);
    currentPath = async () =>
      String(await view.evaluate('location.pathname + location.search'));
    await raw.launch();
    if (args.snapshot !== undefined) {
      await injectWebViewSnapshotAuth({
        view,
        actorId: args.id,
        snapshot: args.snapshot,
        namespace: simClientNamespace(args.id),
        origin: webOrigin,
      });
    }
  } else {
    const session = args.ui.session;
    if (session === undefined) {
      throw new Error(
        'launchActor: solid-dom host requires a MultiAppSolidDomSession (in-process tests)'
      );
    }
    const history = createMemoryHistory();
    const runFor = args.ui.runFor;
    raw = await createSolidDomClientDriver({
      sim: args.sim,
      id: args.id,
      session,
      runFor,
      history,
    });
    openLink = async (path) => {
      history.set({ value: path });
      await runFor(0);
    };
    currentPath = () => Promise.resolve(history.get());
    await raw.launch();
  }
  const ui =
    args.recorder !== undefined
      ? recordingDriver(raw, { recorder: args.recorder, actorId: args.id })
      : raw;
  return {
    handle: { id: args.id, ui, localSql, openLink, currentPath },
    raw,
    closeResources,
  };
}

export async function closeActorEntry(entry: ActorEntry): Promise<void> {
  try {
    await entry.raw.close();
  } catch {
    // ignore teardown races
  }
  try {
    await entry.closeResources();
  } catch {
    // ignore teardown races
  }
}
