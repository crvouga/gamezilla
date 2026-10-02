import { pollUntil, scenarioAction } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import { createReportsApp } from '@libs/server-app/reports/route';
import { testReportKey } from '@pkgs/harness';
import {
  closeCommit,
  openCommit,
  publishSource,
} from '@pkgs/harness-report/remote/publish';
import {
  arrangeCatalog,
  createHttpReportFetcher,
  createRemoteReport,
  memoryReportCache,
  reportQueryClient,
  testCatalogEntity,
} from '@pkgs/harness-report/viewer';
import { createHonoHttpClient } from '@pkgs/http-client';
import { writeUtf8 } from '@pkgs/object-store/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { recordedReport, reportMeta } from './developer-report';
import { tools } from './developer-tools-state';

const EARLIER = '1111111111111111111111111111111111111111';
const LATER = '2222222222222222222222222222222222222222';
export const provideCatalog = scenarioAction({
  name: 'provideCatalog',
  act: async (s, kind: string) => {
    const store = tools(s).reportStore;
    await openCommit(store, {
      sha: EARLIER,
      branch: 'investigation',
      runUrl: null,
      startedAtMs: 0,
      frameCss: '',
    });
    const local = new ObjectStoreImplInMemory();
    const report = recordedReport('current').report;
    await writeUtf8(
      local,
      testReportKey('latest', 'completed'),
      JSON.stringify({
        ...report,
        meta: {
          ...reportMeta(
            'Alice accepts a friend request',
            kind === 'failures' ? 'failed' : 'passed'
          ),
          testId: 'completed',
        },
      }),
      'application/json'
    );
    if (kind === 'failures')
      await writeUtf8(
        local,
        testReportKey('latest', 'passing'),
        JSON.stringify({
          ...report,
          meta: { ...reportMeta('Bob opens a space'), testId: 'passing' },
        }),
        'application/json'
      );
    await publishSource(store, {
      sha: EARLIER,
      packageDir: 'investigation',
      bucket: 'completed',
      local,
    });
    if (kind === 'editions') {
      await closeCommit(store, { sha: EARLIER, endedAtMs: 300 });
      await openCommit(store, {
        sha: LATER,
        branch: 'investigation',
        runUrl: null,
        startedAtMs: 400,
        frameCss: '',
      });
      const later = new ObjectStoreImplInMemory();
      await writeUtf8(
        later,
        testReportKey('latest', 'later'),
        JSON.stringify({
          ...report,
          meta: { ...reportMeta('Later edition only'), testId: 'later' },
        }),
        'application/json'
      );
      await publishSource(store, {
        sha: LATER,
        packageDir: 'investigation',
        bucket: 'completed',
        local: later,
      });
      await closeCommit(store, { sha: LATER, endedAtMs: 700 });
    } else if (kind !== 'running')
      await closeCommit(store, { sha: EARLIER, endedAtMs: 300 });
  },
});
export const openCatalog = scenarioAction({
  name: 'openCatalog',
  act: async (s) => {
    const state = tools(s);
    state.remote?.dispose();
    const http = createHonoHttpClient({
      app: createReportsApp({
        store: state.reportStore,
        clock: s.harness.clock,
        timers: s.session.ports.timers,
      }),
      origin: 'http://reports',
    });
    const client = reportQueryClient();
    const remote = createRemoteReport({
      http,
      timers: s.session.ports.timers,
      apiBase: 'http://reports',
      sha: EARLIER,
      fetcher: createHttpReportFetcher({
        http,
        apiBase: 'http://reports',
        client,
        cache: memoryReportCache(),
      }),
    });
    state.remote = remote;
    s.session.onDispose(() => {
      remote.dispose();
      client.clear();
    });
    await pollUntil(
      s,
      () => Promise.resolve(remote.data.tests.length > 0 ? true : null),
      { maxMs: 1000, description: 'published reports' }
    );
  },
});
export const filterCatalog = scenarioAction({
  name: 'filterCatalog',
  act: (s, search: string, failed = false) => {
    tools(s).catalogQuery = {
      ...tools(s).catalogQuery,
      q: search,
      status: failed ? 'failed' : 'all',
    };
  },
});
export const openCompletedReport = scenarioAction({
  name: 'openCompletedReport',
  act: async (s) => {
    const remote = tools(s).remote;
    if (remote === null) throw new Error('Catalog missing');
    const id = remote.data.tests[0]?.report.meta.testId;
    if (id === undefined) throw new Error('Completed test missing');
    remote.loader.load(id);
    await pollUntil(
      s,
      () =>
        Promise.resolve(remote.loader.state(id).kind === 'ready' ? true : null),
      { maxMs: 1000, description: 'completed report' }
    );
  },
});
export function catalogShown(s: ProductHarness) {
  const state = tools(s);
  return arrangeCatalog(
    (state.remote?.data.tests ?? []).map(testCatalogEntity),
    state.catalogQuery
  ).flatMap((group) => group.entities);
}
export function catalogEdition(s: ProductHarness) {
  return tools(s).remote?.commit()?.sha ?? null;
}
export function catalogRunning(s: ProductHarness) {
  return tools(s).remote?.commit()?.state === 'running';
}
export function completedReportOpen(s: ProductHarness) {
  const remote = tools(s).remote;
  const id = remote?.data.tests[0]?.report.meta.testId;
  return id === undefined ? false : remote?.loader.state(id).kind === 'ready';
}
