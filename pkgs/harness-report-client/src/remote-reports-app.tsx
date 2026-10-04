/**
 * The reports screen over a reports API: every published commit, newest
 * first, and one commit's report. Lists and frame files go through a
 * TanStack Query cache that persists across visits. The host owns the URL
 * (`sha` in, `onOpen` out) and injects transport, time and the cache.
 */

import type { Timers } from '@pkgs/clock-shared/types';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import {
  createInfiniteQuery,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/solid-query';
import {
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  onMount,
  Show,
} from 'solid-js';

import { HarnessReportApp } from './report-app';
import { CatalogSkeleton, EntityBrowser } from './entity-browser';
import type { CatalogEntity, CatalogQuery } from '@pkgs/harness-report-shared/catalog';
import { fmtDate } from '@pkgs/harness-report-shared/format';
import { createHttpReportFetcher, memoryReportCache, ReportsUnavailable, reportQueryClient, reportQueryKey } from './fetcher';
import type { ReportCache, ReportFetcher } from './fetcher';
import { attachReportCache } from './persist';
import type { CommitPage, CommitRecord } from '@pkgs/harness-report-shared/protocol';
import { createRemoteReport } from './remote-report';
import '../styles.css';

export type RemoteReportsAppProps = {
  readonly http: HttpClient;
  readonly timers: Timers;
  /** The reports API root (`https://api.example.com/api/reports`). */
  readonly apiBase: string;
  /** The commit shown, or null for the list of commits. */
  readonly sha: string | null;
  readonly onOpen: (sha: string | null) => void;
  /** Survives reloads. Defaults to an in-memory cache. */
  readonly cache?: ReportCache | undefined;
};

const COMMIT_QUERY: CatalogQuery = {
  q: '',
  status: 'all',
  group: 'none',
  sort: 'recent',
  layout: 'list',
};

function commitEntity(commit: CommitRecord): CatalogEntity {
  const status =
    commit.state === 'running' ? 'running' : (commit.status ?? 'passed');
  const duration =
    commit.endedAtMs === null ? null : commit.endedAtMs - commit.startedAtMs;
  return {
    id: commit.sha,
    title: `${commit.sha.slice(0, 9)} · ${commit.branch}`,
    status,
    durationMs: duration,
    file: commit.branch,
    packageName: commit.branch,
    runtime: status,
    detail: fmtDate(commit.startedAtMs),
    search: `${commit.sha} ${commit.branch} ${status}`,
    href: commit.runUrl,
  };
}

function ReportsShell(props: { children: JSX.Element }) {
  return (
    <div class="harness-report-root sr-app">
      <header class="sr-header">
        <h1>Spec reports</h1>
        <span class="sr-spacer" />
      </header>
      <div class="sr-content sr-content-scroll">{props.children}</div>
    </div>
  );
}

export function RemoteReportsApp(props: RemoteReportsAppProps) {
  const cache = props.cache ?? memoryReportCache();
  const client = reportQueryClient();
  const fetcher = createHttpReportFetcher({
    http: props.http,
    apiBase: props.apiBase,
    client,
    cache,
  });
  const [ready, setReady] = createSignal(false);
  onMount(() => {
    let alive = true;
    const [unsubscribe, restored] = attachReportCache(client, cache);
    onCleanup(() => {
      alive = false;
      unsubscribe();
    });
    void restored.then(() => {
      if (alive) setReady(true);
    });
  });
  return (
    <QueryClientProvider client={client}>
      <Show
        when={ready()}
        fallback={
          <ReportsShell>
            <CatalogSkeleton />
          </ReportsShell>
        }
      >
        <Show
          when={props.sha}
          keyed
          fallback={<CommitList fetcher={fetcher} onOpen={props.onOpen} />}
        >
          {(sha) => <CommitReport {...props} sha={sha} fetcher={fetcher} />}
        </Show>
      </Show>
    </QueryClientProvider>
  );
}

function CommitReport(
  props: RemoteReportsAppProps & {
    readonly sha: string;
    readonly fetcher: ReportFetcher;
  }
) {
  const remote = createRemoteReport({
    http: props.http,
    timers: props.timers,
    apiBase: props.apiBase,
    sha: props.sha,
    fetcher: props.fetcher,
  });
  onCleanup(() => remote.dispose());
  const pending = createMemo(
    () => remote.phase() === 'connecting' && remote.data.tests.length === 0
  );
  return (
    <HarnessReportApp
      data={remote.data}
      frameCss={remote.frameCss()}
      loader={remote.loader}
      pending={pending()}
      home={{ label: 'Reports', onOpen: () => props.onOpen(null) }}
    />
  );
}

function commitFailure(error: unknown): string {
  return error instanceof ReportsUnavailable
    ? 'This deployment has no reports credential, so it cannot read the reports store.'
    : 'Could not reach the reports API.';
}

function CommitList(props: {
  readonly fetcher: ReportFetcher;
  readonly onOpen: (sha: string | null) => void;
}) {
  const client = useQueryClient();
  const [filters, setFilters] = createSignal<CatalogQuery>(COMMIT_QUERY);
  const query = createInfiniteQuery(() => ({
    queryKey: reportQueryKey.commits,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      props.fetcher.commits(pageParam),
    getNextPageParam: (last: CommitPage) => last.cursor ?? undefined,
    staleTime: 30_000,
  }));
  const entities = createMemo(() =>
    (query.data?.pages ?? []).flatMap((page) => page.commits.map(commitEntity))
  );
  return (
    <ReportsShell>
      <div class="sr-list-head">
        <button
          type="button"
          class="sr-navbtn"
          onClick={() =>
            void client.invalidateQueries({ queryKey: reportQueryKey.commits })
          }
        >
          Refresh
        </button>
      </div>
      <Show when={query.isError && entities().length === 0}>
        <div class="sr-note">{commitFailure(query.error)}</div>
      </Show>
      <EntityBrowser
        entities={entities()}
        query={filters()}
        onQuery={setFilters}
        onOpen={(sha) => props.onOpen(sha)}
        empty={
          query.isPending || query.isError ? '' : 'No commit has a report yet.'
        }
        pending={query.isPending}
      />
      <Show when={query.hasNextPage}>
        <button
          type="button"
          class="sr-navbtn"
          disabled={query.isFetchingNextPage}
          onClick={() => void query.fetchNextPage()}
        >
          Older reports
        </button>
      </Show>
    </ReportsShell>
  );
}
