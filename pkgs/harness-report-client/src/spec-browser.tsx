import { useLingui } from '@lingui/solid/macro';
import type { SpecEntry } from '@pkgs/harness-report-shared/explorer-types';
import { specEvidenceCounts } from '@pkgs/harness-report-shared/spec-evidence';
import type { HtmlReportTest } from '@pkgs/harness-root-shared/bundle';
import { Badge } from '@pkgs/ui-root-client/badge';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { ExplorerWorkspace } from '@pkgs/ui-root-client/explorer-workspace';
import { FilterBar } from '@pkgs/ui-root-client/filter-bar';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { Notice } from '@pkgs/ui-root-client/notice';
import { PaginationControls } from '@pkgs/ui-root-client/pagination-controls';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import { Select } from '@pkgs/ui-root-client/select';
import { createMemo, createSignal, For, Show } from 'solid-js';
import type { ExplorerResource } from './explorer-resource';
import { SpecDetail } from './spec-detail';

const PAGE_SIZE = 48;

type SpecBrowserProps = {
  readonly resource: ExplorerResource;
  readonly tests: readonly HtmlReportTest[];
  readonly selected: string;
  readonly onSelect: (path: string) => void;
  readonly onOpen: (id: string) => void;
  readonly onOpenPart: (kind: string, path: string) => void;
};

function SpecList(
  props: SpecBrowserProps & { readonly entries: readonly SpecEntry[] }
) {
  const { t } = useLingui();
  const counts = createMemo(() => specEvidenceCounts(props.tests));
  const [query, setQuery] = createSignal('');
  const [domain, setDomain] = createSignal('all');
  const [page, setPage] = createSignal(0);
  const domains = createMemo(() =>
    [...new Set(props.entries.map((entry) => entry.domain))].sort()
  );
  const filtered = createMemo(() =>
    props.entries.filter(
      (entry) =>
        (domain() === 'all' || entry.domain === domain()) &&
        `${entry.title} ${entry.path} ${entry.kind}`
          .toLowerCase()
          .includes(query().trim().toLowerCase())
    )
  );
  const pageCount = createMemo(() => Math.ceil(filtered().length / PAGE_SIZE));
  const visible = createMemo(() =>
    filtered().slice(
      Math.min(page(), Math.max(0, pageCount() - 1)) * PAGE_SIZE,
      (Math.min(page(), Math.max(0, pageCount() - 1)) + 1) * PAGE_SIZE
    )
  );
  const groups = createMemo(() => [
    ...new Set(visible().map((entry) => entry.domain)),
  ]);
  return (
    <>
      <FilterBar
        value={query()}
        onChange={(value) => {
          setQuery(value);
          setPage(0);
        }}
        label={t`Find specs`}
        placeholder={t`Name, context, or path`}
      >
        <Select
          label={t`Context`}
          value={domain()}
          onValueChange={(value) => {
            setDomain(value);
            setPage(0);
          }}
          options={[
            { value: 'all', label: t`All contexts` },
            ...domains().map((value) => ({ value, label: value })),
          ]}
        />
        <Badge intent="neutral" label={t`${filtered().length} specs`} />
      </FilterBar>
      <ScrollView class="flex-1" contentClass="gap-6">
        <Show
          when={filtered().length > 0}
          fallback={
            <SpecListEmpty
              onClear={() => {
                setQuery('');
                setDomain('all');
                setPage(0);
              }}
            />
          }
        >
          <For each={groups()}>
            {(group) => (
              <MenuSection title={group}>
                <For each={visible().filter((entry) => entry.domain === group)}>
                  {(entry) => (
                    <SpecEntryRow
                      entry={entry}
                      selected={props.selected}
                      onSelect={props.onSelect}
                      count={counts().get(entry.path) ?? 0}
                    />
                  )}
                </For>
              </MenuSection>
            )}
          </For>
        </Show>
        <Show when={pageCount() > 1}>
          <PaginationControls
            pageIndex={Math.min(page(), pageCount() - 1)}
            pageCount={pageCount()}
            onPageChange={setPage}
          />
        </Show>
      </ScrollView>
    </>
  );
}

export function SpecBrowser(props: SpecBrowserProps) {
  const { t } = useLingui();
  const entries = createMemo(
    () => props.resource.data()?.inventory?.entries ?? []
  );
  const entry = createMemo(() =>
    entries().find((item) => item.path === props.selected)
  );
  return (
    <Show
      when={!props.resource.pending()}
      fallback={<LoadingState caption={t`Loading spec inventory…`} />}
    >
      <Show
        when={!props.resource.error()}
        fallback={
          <Notice tone="error">{t`The spec inventory could not be loaded. Refresh to try again; no missing evidence is counted as passed.`}</Notice>
        }
      >
        <Show
          when={entries().length > 0}
          fallback={
            <EmptyState
              title={t`Spec inventory unavailable`}
              body={t`This version has no published inventory. Existing test reports remain available in Test runs. Run full verification to publish every spec for this version.`}
            />
          }
        >
          <ExplorerWorkspace
            masterLabel={t`Spec inventory`}
            detailLabel={t`Spec and evidence`}
            selected={entry() !== undefined}
            backLabel={t`All specs`}
            onBack={() => props.onSelect('')}
            master={<SpecList {...props} entries={entries()} />}
            detail={
              <ScrollView class="flex-1">
                <Show
                  when={entry()}
                  keyed
                  fallback={
                    <EmptyState
                      title={t`Explore a spec`}
                      body={t`Choose a spec to read its promises and investigate its recorded evidence.`}
                    />
                  }
                >
                  {(selected) => (
                    <SpecDetail
                      entry={selected}
                      resource={props.resource}
                      tests={props.tests}
                      onOpen={props.onOpen}
                      onOpenPart={props.onOpenPart}
                    />
                  )}
                </Show>
              </ScrollView>
            }
          />
        </Show>
      </Show>
    </Show>
  );
}

function SpecEntryRow(props: {
  entry: SpecEntry;
  selected: string;
  onSelect: (path: string) => void;
  count: number;
}) {
  return (
    <MenuRow
      dataSet={{
        testid: 'spec-entry',
        'spec-path': props.entry.path,
      }}
      title={props.entry.title}
      caption={props.entry.path.split('/').at(-1)}
      selected={props.selected === props.entry.path}
      onClick={() => props.onSelect(props.entry.path)}
      trailing={
        <Badge
          intent="neutral"
          size="sm"
          label={props.count || props.entry.kind}
        />
      }
    />
  );
}

function SpecListEmpty(props: { onClear: () => void }) {
  const { t } = useLingui();
  return (
    <EmptyState
      variant="compact"
      title={t`No specs match`}
      body={t`Try another search or context.`}
      action={{ label: t`Clear filters`, onClick: props.onClear }}
    />
  );
}
