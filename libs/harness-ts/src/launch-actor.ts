import { readEmbeddedHref } from '@libs/app-root-shared-ts/embedded-href';
import {
  DEVICE_ID_KEY,
  LAST_LOCAL_ACCOUNT_ID_KEY,
  SESSION_TOKEN_KEY,
} from '@libs/auth-shared-ts/auth-storage-keys';
import { createSignal } from 'solid-js';
import { createBrowserNavigation } from './browser-navigation';
/**
 * Per-actor UI launch / teardown for the product system runtime.
 */

import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import type { HarnessSystemSnapshot } from '@pkgs/harness-console-shared-ts/system-snapshot';
import {
  executeSqlStatements,
  type SqlStatement,
} from '@pkgs/sql-client-root-shared-ts/statements';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import type { MultiAppSolidDomSession } from '@pkgs/ui-testing-solid-dom-client-ts/multi-app-solid-dom-session';
import { createSolidDomDriver } from '@pkgs/ui-testing-solid-dom-client-ts/solid-dom-driver';
import { type MemoryHistoryAdapter, memoryHistory } from '@solidjs/router';
import type { ActorBrowserStorage } from './actor-browser-storage';
import type { Harness } from './create-harness';
import { inProcessDevice, webviewDevice } from './device-probes';
import type { HarnessActor } from './harness';
import { injectWebViewSnapshotAuth } from './inject-webview-snapshot-auth';
import type { ProductUi } from './ports';
import { solidActorRoot } from './solid-actor-root';
import { createHarnessWaitPump } from './wait-pump';
import { webviewAppBuild } from './webview-app-build';
import { webviewCheckpoint } from './webview-checkpoint';
import { webviewLocalSql, webviewSqlStatements } from './webview-local-sql';
import { webviewMutations } from './webview-mutations';

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
  readonly history: MemoryHistoryAdapter;
  readonly viewport: { width: number; height: number };
  readonly shortcutsActive: () => boolean;
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
          solidActorRoot({
            live,
            browser: args.harness.browser(args.id),
            history: args.history,
            viewport: args.viewport,
            shortcutsActive: args.shortcutsActive,
          })
        );
        await args.runFor(0);
        return app;
      },
    },
  });
}

async function actorHistory(
  harness: Harness,
  id: string,
  initialPath?: string
): Promise<MemoryHistoryAdapter> {
  const history = memoryHistory();
  const href =
    initialPath ?? (await readEmbeddedHref((await harness.client(id)).kv));
  if (href !== null) history.set({ value: href, replace: true });
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

type LaunchActorArgs = {
  readonly ui: ProductUi;
  readonly harness: Harness;
  readonly id: string;
  readonly initialPath?: string | undefined;
  readonly snapshot?: HarnessSystemSnapshot;
  readonly browserStorage?: ActorBrowserStorage;
};

async function launchWebview(
  args: LaunchActorArgs & { ui: Extract<ProductUi, { kind: 'bun-webview' }> }
) {
  const webOrigin = args.ui.webOrigin;
  // Each actor is its own device: its own on-disk storage (cookies, OPFS
  // for the app's SQLite), shared with its popups. A reopened tab loads
  // its saved address on its first navigation.
  if (args.browserStorage === undefined)
    throw new Error('Browser devices require persistent device storage');
  const { dataStore, reopenPath } = args.browserStorage;
  const initialUrl = webOrigin + (args.initialPath ?? reopenPath ?? '/');
  const browser = await args.browserStorage.browser.open({
    initialUrl,
    actorId: args.id,
    dataStore,
  });
  const view = browser.view;
  const device = webviewDevice(view);
  // The web app's secure storage is the page's localStorage.
  const stored = (key: string) => async () => {
    const value = await view.evaluate(
      `localStorage.getItem(${JSON.stringify(key)})`
    );
    return typeof value === 'string' ? value : null;
  };
  const sessionToken = stored(SESSION_TOKEN_KEY);
  const deviceId = stored(DEVICE_ID_KEY);
  const memberId = stored(LAST_LOCAL_ACCOUNT_ID_KEY);
  const raw = browser.driver;
  const pageSql = webviewLocalSql(view);
  const localSql = () => pageSql;
  // The device's requests leave its own page, so its build is set there.
  const appBuild = webviewAppBuild(view, args.harness.appBuilds, args.id);
  const closeResources = async () => {
    appBuild.stop();
    await browser.close();
  };
  const openLink = async (path: string) => {
    await view.navigate(`${webOrigin}${path}`);
    await appBuild.apply();
  };
  const currentPath = async () =>
    String(
      await view.evaluate('location.pathname + location.search + location.hash')
    );
  const setViewport = (size: { width: number; height: number }) =>
    view.resize(size.width, size.height);
  try {
    await raw.launch();
    if (args.snapshot !== undefined) {
      await injectWebViewSnapshotAuth({
        view,
        actorId: args.id,
        snapshot: args.snapshot,
        namespace: args.harness.clientNamespace(args.id),
        url: initialUrl,
      });
    }
    await appBuild.apply();
  } catch (error) {
    await closeResources();
    throw error;
  }
  return {
    raw,
    localSql,
    browser: {
      ...createBrowserNavigation({
        readUrl: view.loadedUrl,
        clock: wallClock,
        timers: wallTimers,
      }),
      readyOrigin: view.readyOrigin,
    },
    checkpoint: webviewCheckpoint(view, openLink),
    executeStatements: webviewSqlStatements(view),
    mutations: webviewMutations(view),
    closeResources,
    openLink,
    currentPath,
    setViewport,
    device,
    sessionToken,
    deviceId,
    memberId,
  };
}

async function launchSolid(
  args: LaunchActorArgs & { ui: Extract<ProductUi, { kind: 'solid-dom' }> }
) {
  const session = args.ui.session;
  if (session === undefined) {
    throw new Error(
      'launchActor: solid-dom host requires a MultiAppSolidDomSession (in-process tests)'
    );
  }
  const runFor = args.ui.runFor;
  const history = await actorHistory(args.harness, args.id, args.initialPath);
  const device = inProcessDevice(await args.harness.client(args.id));
  const stored = (key: string) => async () => {
    const value = (await args.harness.client(args.id)).secureStorage.getValue(
      key
    );
    return typeof value === 'string' ? value : null;
  };
  const sessionToken = stored(SESSION_TOKEN_KEY);
  const deviceId = stored(DEVICE_ID_KEY);
  const memberId = stored(LAST_LOCAL_ACCOUNT_ID_KEY);
  const { viewport, changeViewport } = reactiveViewport(runFor);
  const setViewport = changeViewport;
  const localSql = () => args.harness.clientSql(args.id)?.sqlClient ?? null;
  // A provider sending the browser back lands on that address in the app, as
  // the web app's full-page return does.
  const stopReturns = args.harness
    .browser(args.id)
    .onReturnToApp((path) => history.set({ value: path, replace: true }));
  const closeResources = () => {
    stopReturns();
    return Promise.resolve();
  };
  const raw = await createSolidDomClientDriver({
    harness: args.harness,
    id: args.id,
    session,
    runFor,
    history,
    viewport,
    shortcutsActive: () => args.ui.focusedActor() === args.id,
  });
  const openLink = (path: string) => navigateActor(history, runFor, path);
  const currentPath = () => Promise.resolve(history.get());
  await raw.launch();
  return {
    raw,
    localSql,
    closeResources,
    executeStatements: async (statements: readonly SqlStatement[]) => {
      const db = args.harness.clientSql(args.id)?.sqlClient;
      if (db === undefined)
        throw new Error(`Device ${args.id} database unavailable`);
      return executeSqlStatements(db, statements);
    },
    openLink,
    currentPath,
    setViewport,
    device,
    sessionToken,
    deviceId,
    memberId,
  };
}

export async function launchActor(args: LaunchActorArgs): Promise<ActorEntry> {
  const entry =
    args.ui.kind === 'bun-webview'
      ? await launchWebview({ ...args, ui: args.ui })
      : await launchSolid({ ...args, ui: args.ui });
  const { raw, closeResources, ...device } = entry;
  return {
    raw,
    closeResources,
    handle: {
      id: args.id,
      ui: raw,
      ...device,
    },
  };
}

async function navigateActor(
  history: MemoryHistoryAdapter,
  runFor: (durationMs: number) => Promise<void>,
  path: string
): Promise<void> {
  history.set({ value: path });
  await runFor(0);
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
