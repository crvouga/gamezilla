import { useLingui } from '@lingui/solid/macro';
import type { WorkspaceVersion } from '@pkgs/harness-report-shared/explorer-types';
import type {
  CommitPage,
  CommitRecord,
} from '@pkgs/harness-report-shared/protocol';
import { Badge } from '@pkgs/ui-root-client/badge';
import { Button } from '@pkgs/ui-root-client/button';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { FilterBar } from '@pkgs/ui-root-client/filter-bar';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { Notice } from '@pkgs/ui-root-client/notice';
import { PaginationControls } from '@pkgs/ui-root-client/pagination-controls';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import { createInfiniteQuery, useQueryClient } from '@tanstack/solid-query';
import { createMemo, createSignal, For, Show } from 'solid-js';
import type { ReportFetcher } from './fetcher';
import { ReportsUnavailable, reportQueryKey } from './fetcher';
import { fmtDate } from './format-date';
import { ReportStatus } from './report-status';

function VersionRow(props: {
  readonly commit: CommitRecord;
  readonly onOpen: (sha: string | null) => void;
}) {
  return (
    <MenuRow
      title={props.commit.branch}
      caption={
        <span class="box flex-row flex-wrap gap-2">
          <Badge intent="neutral" label={props.commit.sha.slice(0, 9)} />
          <span>{fmtDate(props.commit.startedAtMs)}</span>
        </span>
      }
      trailing={
        <ReportStatus
          status={
            props.commit.state === 'running'
              ? 'running'
              : (props.commit.status ?? 'not-run')
          }
        />
      }
      onClick={() => props.onOpen(props.commit.sha)}
    />
  );
}

export function CommitList(props: {
  readonly fetcher: ReportFetcher;
  readonly onOpen: (sha: string | null) => void;
}) {
  const { t } = useLingui();
  const { search, setSearch, query, commits, shown, refresh } =
    useCommitCatalog(() => props.fetcher);
  return (
    <ScreenBase
      screenId="reports"
      breadcrumbs={[{ name: t`Reports` }]}
      scroll
      actions={[
        {
          type: 'secondary',
          label: t`Refresh`,
          onClick: refresh,
          loading: query.isFetching,
        },
      ]}
      content={() => (
        <div class="box gap-6">
          <ExplorerIntro />
          <Show when={query.data?.pages[0]?.workspace}>
            {(workspace) => (
              <WorkspaceVersionSection
                workspace={workspace()}
                onOpen={props.onOpen}
              />
            )}
          </Show>
          <EvidenceVersions
            versions={query.data?.pages[0]?.evidenceVersions ?? []}
            exclude={commits().map((commit) => commit.sha)}
            search={search()}
            onOpen={props.onOpen}
          />
          <Show when={query.data?.pages[0]?.notice}>
            {(notice) => <Notice>{notice()}</Notice>}
          </Show>
          <Show when={query.isError}>
            <ReportsError error={query.error} onRetry={refresh} />
          </Show>
          <FilterBar
            label={t`Find a version`}
            value={search()}
            onChange={setSearch}
            placeholder={t`Commit hash or branch`}
          />
          <Show
            when={!query.isPending}
            fallback={
              <LoadingState variant="compact" caption={t`Loading versions…`} />
            }
          >
            <Show
              when={shown().length > 0}
              fallback={
                <Show when={!query.isError}>
                  <EmptyState
                    variant="compact"
                    title={
                      commits().length > 0
                        ? t`No versions match`
                        : t`No published reports yet`
                    }
                    body={
                      commits().length > 0
                        ? t`Try another commit hash or branch.`
                        : t`Published evidence appears after automated verification. The current checkout's specs remain available above when running locally.`
                    }
                  />
                </Show>
              }
            >
              <MenuSection title={t`Published versions`}>
                <For each={shown()}>
                  {(commit) => (
                    <VersionRow commit={commit} onOpen={props.onOpen} />
                  )}
                </For>
              </MenuSection>
            </Show>
          </Show>
          <Show when={query.hasNextPage}>
            <Button
              title={t`Load older versions`}
              loading={query.isFetchingNextPage}
              onClick={() => {
                void query.fetchNextPage();
              }}
            />
          </Show>
        </div>
      )}
    />
  );
}

function WorkspaceVersionSection(props: {
  workspace: WorkspaceVersion;
  onOpen: (sha: string | null) => void;
}) {
  const { t } = useLingui();
  return (
    <MenuSection
      title={t`Current checkout`}
      footer={
        props.workspace.dirty
          ? t`Uncommitted changes are present. This explorer shows the committed specs; those changes are excluded from commit evidence.`
          : t`Browse the specs of the version checked out on this machine.`
      }
    >
      <MenuRow
        title={props.workspace.branch}
        caption={props.workspace.sha.slice(0, 9)}
        trailing={<Badge intent="neutral" label={t`Specs available`} />}
        onClick={() => props.onOpen(props.workspace.sha)}
      />
    </MenuSection>
  );
}

function EvidenceVersions(props: {
  versions: readonly string[];
  exclude: readonly string[];
  search: string;
  onOpen: (sha: string | null) => void;
}) {
  const { t } = useLingui();
  const [page, setPage] = createSignal(0);
  const versions = () =>
    props.versions.filter(
      (sha) =>
        !props.exclude.includes(sha) &&
        sha.includes(props.search.trim().toLowerCase())
    );
  const pageCount = () => Math.ceil(versions().length / 30);
  const pageIndex = () => Math.min(page(), Math.max(0, pageCount() - 1));
  return (
    <Show when={versions().length}>
      <MenuSection
        title={t`Independent evidence`}
        footer={t`These versions contain specs or report parts. A completed verification run is shown separately when available.`}
      >
        <For each={versions().slice(pageIndex() * 30, (pageIndex() + 1) * 30)}>
          {(sha) => (
            <MenuRow
              title={sha.slice(0, 9)}
              caption={t`Specs and report parts`}
              onClick={() => props.onOpen(sha)}
            />
          )}
        </For>
        <Show when={pageCount() > 1}>
          <PaginationControls
            pageIndex={pageIndex()}
            pageCount={pageCount()}
            onPageChange={setPage}
          />
        </Show>
      </MenuSection>
    </Show>
  );
}

function ReportsError(props: { error: unknown; onRetry: () => void }) {
  const { t } = useLingui();
  return (
    <Notice tone="error">
      <p>
        {props.error instanceof ReportsUnavailable
          ? t`Published reports are unavailable because this environment has no reports read credential.`
          : t`The reports service could not be reached or returned unreadable evidence. Refresh to try again.`}
      </p>
      <Button
        title={t`Try again`}
        onClick={props.onRetry}
        size="sm"
        dataSet={{ testid: 'reports-retry' }}
      />
    </Notice>
  );
}

function ExplorerIntro() {
  const { t } = useLingui();
  return (
    <div class="box gap-2">
      <h1 class="text textHeading">{t`Explore the app`}</h1>
      <p class="text textCaption">{t`Every spec, recorded outcome, and quality check belongs to a version. Choose a commit to investigate its evidence.`}</p>
    </div>
  );
}

function useCommitCatalog(fetcher: () => ReportFetcher) {
  const client = useQueryClient();
  const [search, setSearch] = createSignal('');
  const query = createInfiniteQuery(() => ({
    queryKey: reportQueryKey.commits,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }: { pageParam: string | null }) =>
      fetcher().commits(pageParam),
    getNextPageParam: (last: CommitPage) => last.cursor ?? undefined,
    staleTime: 0,
    retry: false,
  }));
  const commits = createMemo(() => [
    ...new Map(
      (query.data?.pages ?? [])
        .flatMap((page) => page.commits)
        .map((commit) => [commit.sha, commit])
    ).values(),
  ]);
  const shown = createMemo(() =>
    commits().filter((commit) =>
      `${commit.sha} ${commit.branch}`
        .toLowerCase()
        .includes(search().trim().toLowerCase())
    )
  );
  const refresh = () => {
    void client.invalidateQueries({ queryKey: reportQueryKey.commits });
  };
  return { search, setSearch, query, commits, shown, refresh };
}
