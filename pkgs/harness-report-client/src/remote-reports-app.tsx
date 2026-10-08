import type { Timers } from '@pkgs/clock-shared/types';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import {
  createQuery,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/solid-query';
import { createMemo, createSignal, onCleanup, onMount, Show } from 'solid-js';
import { CommitList } from './commit-list';
import type { ReportCache, ReportFetcher } from './fetcher';
import {
  createHttpReportFetcher,
  memoryReportCache,
  reportQueryClient,
} from './fetcher';
import type { ReportNavigation } from './navigation';
import { attachReportCache } from './persist';
import { createRemoteReport } from './remote-report';
import { HarnessReportApp } from './report-app';
import { resilientReportCache } from './resilient-cache';
import { RevisionPicker } from './revision-picker';
import './styles.css';

export type RemoteReportsAppProps = {
  readonly http: HttpClient;
  readonly navigation: ReportNavigation;
  readonly timers: Timers;
  readonly apiBase: string;
  readonly sha: string | null;
  readonly onOpen: (sha: string | null) => void;
  readonly cache?: ReportCache | undefined;
};

export function RemoteReportsApp(props: RemoteReportsAppProps) {
  const cache = resilientReportCache(props.cache ?? memoryReportCache());
  const client = reportQueryClient();
  const fetcher = createHttpReportFetcher({
    http: props.http,
    apiBase: props.apiBase,
    client,
    cache,
  });
  onMount(() => {
    const [unsubscribe, restored] = attachReportCache(client, cache);
    onCleanup(unsubscribe);
    void restored.catch(() => undefined);
  });
  onCleanup(() => client.clear());
  return (
    <QueryClientProvider client={client}>
      <Show
        when={props.sha}
        keyed
        fallback={<CommitList fetcher={fetcher} onOpen={props.onOpen} />}
      >
        {(sha) => <CommitReport {...props} sha={sha} fetcher={fetcher} />}
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
  const client = useQueryClient();
  const [revision, setRevision] = createSignal(1);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ['reports'] });
    setRevision((value) => value + 1);
  };
  return (
    <Show when={revision()} keyed>
      {(_revision) => <CommitReportContent {...props} refresh={refresh} />}
    </Show>
  );
}

function CommitReportContent(
  props: RemoteReportsAppProps & {
    readonly sha: string;
    readonly fetcher: ReportFetcher;
    readonly refresh: () => void;
  }
) {
  const [choosingRevision, setChoosingRevision] = createSignal(false);
  const remote = createRemoteReport({
    http: props.http,
    timers: props.timers,
    apiBase: props.apiBase,
    sha: props.sha,
    fetcher: props.fetcher,
  });
  onCleanup(() => remote.dispose());
  const query = createQuery(() => ({
    queryKey: ['reports', 'explorer-view', props.sha],
    queryFn: () => props.fetcher.explorer(props.sha),
    staleTime: 0,
    retry: false,
  }));
  const pending = createMemo(
    () => remote.phase() === 'connecting' && remote.data.tests.length === 0
  );
  return (
    <>
      <HarnessReportApp
        navigation={{
          ...props.navigation,
          subscribeKeys: (listener) =>
            props.navigation.subscribeKeys((event) => {
              if (!choosingRevision()) listener(event);
            }),
        }}
        data={remote.data}
        frameCss={remote.frameCss()}
        loader={remote.loader}
        pending={pending()}
        onOpenReports={() => props.onOpen(null)}
        explorer={{
          data: () => query.data,
          pending: () => query.isPending,
          error: () => query.error,
          readSpec: (path) => props.fetcher.spec(props.sha, path),
        }}
        sources={remote.sources()}
        sha={props.sha}
        phase={remote.phase()}
        runUrl={remote.commit()?.runUrl}
        onRefresh={props.refresh}
        onChooseRevision={() => setChoosingRevision(true)}
      />
      <Show when={choosingRevision()}>
        <RevisionPicker
          fetcher={props.fetcher}
          selectedSha={props.sha}
          onOpen={props.onOpen}
          onClose={() => setChoosingRevision(false)}
        />
      </Show>
    </>
  );
}
