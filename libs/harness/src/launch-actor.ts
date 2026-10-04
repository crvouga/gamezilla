import { readEmbeddedHref } from '@libs/app-shared/embedded-href';
import { createSignal } from 'solid-js';
/**
 * Per-actor UI launch / teardown for the product system runtime.
 */

import { wallClock, wallTimers } from '@pkgs/clock-shared/wall';
import type { HarnessSystemSnapshot } from '@pkgs/harness-console-shared/system-snapshot';
import type { SqlTx } from '@pkgs/sql-client-shared/interface';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared/bun-webview-driver';
import type { Driver } from '@pkgs/ui-testing-shared/driver';
import { recordingDriver } from '@pkgs/ui-testing-shared/recording-driver';
import type { StepRecorder } from '@pkgs/ui-testing-shared/step-recorder';
import type { MultiAppSolidDomSession } from '@pkgs/ui-testing-solid-dom-client/multi-app-solid-dom-session';
import { createSolidDomDriver } from '@pkgs/ui-testing-solid-dom-client/solid-dom-driver';
import { createMemoryHistory, type MemoryHistory } from '@solidjs/router';
import type { Harness } from './create-harness';
import { inProcessDevice, webviewDevice } from './device-probes';
import type { HarnessActor, HarnessDevice } from './harness';
import { injectWebViewSnapshotAuth } from './inject-webview-snapshot-auth';
import type { ProductUi } from './ports';
import { solidActorRoot } from './solid-actor-root';
import { createHarnessWaitPump } from './wait-pump';
import { webviewLocalSql } from './webview-local-sql';

export type ActorEntry = {
  readonly handle: HarnessActor;
  readonly raw: Driver;
  readonly closeResources: () => Promise<void>;
};

/**
 * Solid DOM driver for one in-process actor. Waits are pump-driven (the harness's
 * virtual `runFor`), deadlines run on the wall clock so virtual-time stepping
 * never eats the wait budget.
 */
async function createSolidDomClientDriver(args: {
  readonly harness: Harness;
  readonly id: string;
  readonly session: MultiAppSolidDomSession;
  readonly runFor: (durationMs: number) => Promise<void>;
  readonly history: MemoryHistory;
  readonly viewport: { width: number; height: number };
}): Promise<Driver> {
  const live = await args.harness.spawnClient(args.id);
  const pump = createHarnessWaitPump({
    scheduler: args.harness.scheduler,
    runFor: args.runFor,
  });
  return createSolidDomDriver({
    clock: wallClock,
    pump,
    harness: {
      mount: async () => {
        const app = args.session.mountActor(
          args.id,
          solidActorRoot(
            live,
            args.harness.browser(args.id),
            args.history,
            args.viewport
          )
        );
        await args.runFor(0);
        return app;
      },
    },
  });
}

async function actorDataStore(id: string) {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const directory = await mkdtemp(join(tmpdir(), `harness-webview-${id}-`));
  return {
    dataStore: { directory },
    cleanup: () => rm(directory, { recursive: true, force: true }),
  };
}

async function actorHistory(
  harness: Harness,
  id: string
): Promise<MemoryHistory> {
  const history = createMemoryHistory();
  const savedHref = await readEmbeddedHref((await harness.client(id)).kv);
  if (savedHref !== null) history.set({ value: savedHref, replace: true });
  return history;
}

function reactiveViewport(runFor: (ms: number) => Promise<void>) {
  const [size, updateSize] = createSignal({ width: 390, height: 844 });
  const viewport = {
    get width() {
      return size().width;
    },
    get height() {
      return size().height;
    },
  };
  const changeViewport = async (next: { width: number; height: number }) => {
    updateSize(next);
    await runFor(0);
  };
  return { viewport, changeViewport };
}

function recorded(
  raw: Driver,
  id: string,
  recorder: StepRecorder | undefined
): Driver {
  return recorder === undefined
    ? raw
    : recordingDriver(raw, { recorder, actorId: id });
}

export async function launchActor(args: {
  readonly ui: ProductUi;
  readonly harness: Harness;
  readonly id: string;
  readonly snapshot?: HarnessSystemSnapshot;
  /** When set, every driver op becomes a report step for this actor. */
  readonly recorder?: StepRecorder;
}): Promise<ActorEntry> {
  let raw: Driver;
  let localSql: () => SqlTx | null = () =>
    args.harness.clientSql(args.id)?.sqlClient ?? null;
  let closeResources: () => Promise<void> = () => Promise.resolve();
  let openLink: (path: string) => Promise<void>;
  let currentPath: () => Promise<string>;
  let setViewport: (size: { width: number; height: number }) => Promise<void>;
  let device: HarnessDevice;
  if (args.ui.kind === 'bun-webview') {
    const webOrigin = args.ui.webOrigin;
    // Each actor is its own device: its own on-disk storage (cookies, OPFS
    // for the app's SQLite), shared with the popups it opens. No URL here:
    // the driver's `launch` navigates and awaits the load.
    const { dataStore, cleanup } = await actorDataStore(args.id);
    const view = new Bun.WebView({ width: 390, height: 844, dataStore });
    device = webviewDevice(view);
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
      await cleanup();
    };
    openLink = (path) => view.navigate(`${webOrigin}${path}`);
    currentPath = async () =>
      String(await view.evaluate('location.pathname + location.search'));
    setViewport = (size) => view.resize(size.width, size.height);
    await raw.launch();
    if (args.snapshot !== undefined) {
      await injectWebViewSnapshotAuth({
        view,
        actorId: args.id,
        snapshot: args.snapshot,
        namespace: args.harness.clientNamespace(args.id),
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
    const runFor = args.ui.runFor;
    const history = await actorHistory(args.harness, args.id);
    device = inProcessDevice(await args.harness.client(args.id));
    const { viewport, changeViewport } = reactiveViewport(runFor);
    setViewport = changeViewport;
    raw = await createSolidDomClientDriver({
      harness: args.harness,
      id: args.id,
      session,
      runFor,
      history,
      viewport,
    });
    openLink = async (path) => {
      history.set({ value: path });
      await runFor(0);
    };
    currentPath = () => Promise.resolve(history.get());
    await raw.launch();
  }
  const ui = recorded(raw, args.id, args.recorder);
  return {
    handle: {
      id: args.id,
      ui,
      localSql,
      openLink,
      currentPath,
      setViewport,
      device,
    },
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
