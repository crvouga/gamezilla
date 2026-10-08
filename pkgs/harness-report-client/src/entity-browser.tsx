import { useLingui } from '@lingui/solid/macro';
import type {
  CatalogEntity,
  CatalogGroup,
  CatalogQuery,
  CatalogSort,
  CatalogStatus,
} from '@pkgs/harness-report-shared/catalog';
import { arrangeCatalog } from '@pkgs/harness-report-shared/catalog';
import { fmtMs } from '@pkgs/harness-report-shared/format';
import { Badge } from '@pkgs/ui-root-client/badge';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { FilterBar } from '@pkgs/ui-root-client/filter-bar';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { PaginationControls } from '@pkgs/ui-root-client/pagination-controls';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import { Select } from '@pkgs/ui-root-client/select';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { ReportStatus } from './report-status';

const PAGE_SIZE = 64;

type BrowserProps = {
  readonly entities: readonly CatalogEntity[];
  readonly query: CatalogQuery;
  readonly onQuery: (query: CatalogQuery) => void;
  readonly onOpen: (id: string) => void;
  readonly empty: string;
  readonly pending: boolean;
};

function CatalogBar(
  props: Pick<BrowserProps, 'query' | 'onQuery'> & {
    readonly resetPage: () => void;
  }
) {
  const { t } = useLingui();
  const set = (patch: Partial<CatalogQuery>) => {
    props.resetPage();
    props.onQuery({ ...props.query, ...patch });
  };
  return (
    <FilterBar
      value={props.query.q}
      onChange={(q) => set({ q })}
      label={t`Find test runs`}
      placeholder={t`Name, spec, or package`}
    >
      <Select
        label={t`Outcome`}
        value={props.query.status}
        onValueChange={(status) => set({ status: status as CatalogStatus })}
        options={[
          { value: 'all', label: t`All outcomes` },
          { value: 'failed', label: t`Failed` },
          { value: 'passed', label: t`Passed` },
          { value: 'skipped', label: t`Skipped` },
        ]}
      />
      <Select
        label={t`Group`}
        value={props.query.group}
        onValueChange={(group) => set({ group: group as CatalogGroup })}
        options={[
          { value: 'package', label: t`Package` },
          { value: 'file', label: t`Spec` },
          { value: 'status', label: t`Outcome` },
          { value: 'runtime', label: t`Runtime` },
          { value: 'none', label: t`No grouping` },
        ]}
      />
      <Select
        label={t`Sort`}
        value={props.query.sort}
        onValueChange={(sort) => set({ sort: sort as CatalogSort })}
        options={[
          { value: 'status', label: t`Failures first` },
          { value: 'duration', label: t`Longest first` },
          { value: 'name', label: t`Name` },
          { value: 'recent', label: t`Recorded order` },
        ]}
      />
    </FilterBar>
  );
}

export function CatalogSkeleton() {
  const { t } = useLingui();
  return (
    <LoadingState variant="compact" caption={t`Loading recorded test runs…`} />
  );
}

export function EntityBrowser(props: BrowserProps) {
  const { t } = useLingui();
  const [page, setPage] = createSignal(0);
  const ordered = createMemo(() =>
    arrangeCatalog(props.entities, props.query).flatMap(
      (group) => group.entities
    )
  );
  const pageCount = () => Math.ceil(ordered().length / PAGE_SIZE);
  const pageIndex = () => Math.min(page(), Math.max(0, pageCount() - 1));
  const groups = createMemo(() =>
    arrangeCatalog(
      ordered().slice(pageIndex() * PAGE_SIZE, (pageIndex() + 1) * PAGE_SIZE),
      { ...props.query, q: '', status: 'all', sort: 'recent' }
    )
  );
  return (
    <div class="box flex-1 min-h-0 gap-4">
      <CatalogBar
        query={props.query}
        onQuery={props.onQuery}
        resetPage={() => setPage(0)}
      />
      <ScrollView class="flex-1" contentClass="gap-6">
        <Show
          when={!props.pending || props.entities.length > 0}
          fallback={<CatalogSkeleton />}
        >
          <Show
            when={ordered().length > 0}
            fallback={
              <EmptyState
                variant="compact"
                title={props.empty}
                action={
                  props.query.q || props.query.status !== 'all'
                    ? {
                        label: t`Clear filters`,
                        onClick: () =>
                          props.onQuery({
                            ...props.query,
                            q: '',
                            status: 'all',
                          }),
                      }
                    : undefined
                }
              />
            }
          >
            <For each={groups()}>
              {(group) => (
                <MenuSection
                  title={props.query.group === 'none' ? undefined : group.name}
                  footer={t`${group.entities.length} shown`}
                >
                  <div
                    class="box"
                    classList={{
                      'grid grid-cols-1 sm:grid-cols-2':
                        props.query.layout === 'grid',
                    }}
                  >
                    <For each={group.entities}>
                      {(entity) => (
                        <MenuRow
                          title={entity.title}
                          caption={entity.detail || entity.file}
                          onClick={() => props.onOpen(entity.id)}
                          trailing={
                            <span class="box flex-row flex-wrap items-center gap-2">
                              <Show when={entity.durationMs !== null}>
                                <Badge
                                  intent="neutral"
                                  size="sm"
                                  label={fmtMs(entity.durationMs)}
                                />
                              </Show>
                              <ReportStatus status={entity.status} />
                            </span>
                          }
                        />
                      )}
                    </For>
                  </div>
                </MenuSection>
              )}
            </For>
            <Show when={pageCount() > 1}>
              <PaginationControls
                pageIndex={pageIndex()}
                pageCount={pageCount()}
                onPageChange={setPage}
              />
            </Show>
          </Show>
        </Show>
      </ScrollView>
    </div>
  );
}
