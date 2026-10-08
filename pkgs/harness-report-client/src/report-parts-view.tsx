import { useLingui } from '@lingui/solid/macro';
import type {
  EvidenceCheck,
  ReportPart,
} from '@pkgs/harness-report-shared/explorer-types';
import { partStatus } from '@pkgs/harness-report-shared/report-parts';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { FilterBar } from '@pkgs/ui-root-client/filter-bar';
import { MenuRow } from '@pkgs/ui-root-client/menu-row';
import { MenuSection } from '@pkgs/ui-root-client/menu-section';
import { Notice } from '@pkgs/ui-root-client/notice';
import { PaginationControls } from '@pkgs/ui-root-client/pagination-controls';
import { ScrollView } from '@pkgs/ui-root-client/scroll-view';
import { Select } from '@pkgs/ui-root-client/select';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  on,
  Show,
} from 'solid-js';
import { ReportStatus } from './report-status';

const PAGE_SIZE = 64;

function PartChecks(props: {
  readonly part: ReportPart;
  readonly checks: readonly EvidenceCheck[];
  readonly onOpen: (id: string) => void;
  readonly canOpen: (id: string) => boolean;
}) {
  const { t } = useLingui();
  return (
    <div class="box gap-3">
      <MenuSection
        title={
          <span class="box flex-row flex-wrap gap-2 items-center">
            {props.part.title}
            <ReportStatus status={partStatus(props.part)} />
          </span>
        }
        footer={t`${props.part.checks.length} recorded checks`}
      >
        <For each={props.checks}>
          {(check) => (
            <MenuRow
              title={check.title}
              caption={
                <div class="box gap-1">
                  <Show when={check.detail}>
                    <span>{check.detail}</span>
                  </Show>
                  <For each={check.measurements}>
                    {(metric) => (
                      <span>{`${metric.name}: ${metric.value.toFixed(2)} ${metric.unit}${metric.limit === undefined ? '' : ` / ${metric.limit} ${metric.unit}`}`}</span>
                    )}
                  </For>
                </div>
              }
              trailing={<ReportStatus status={check.status} />}
              onClick={
                props.canOpen(check.id)
                  ? () => props.onOpen(check.id)
                  : undefined
              }
            />
          )}
        </For>
      </MenuSection>
    </div>
  );
}

type ReportPartsViewProps = {
  readonly kind: string;
  readonly initialQuery?: string | undefined;
  readonly unavailable?: boolean;
  readonly parts: readonly ReportPart[];
  readonly onOpen: (id: string) => void;
  readonly canOpen: (id: string) => boolean;
};

export function ReportPartsView(props: ReportPartsViewProps) {
  const { t } = useLingui();
  const {
    query,
    setQuery,
    status,
    setStatus,
    setPage,
    parts,
    filtered,
    pageCount,
    pageIndex,
    visible,
    groups,
  } = useParts(props);
  const absent = useAbsentMessage(
    () => props.kind,
    () => props.unavailable
  );
  return (
    <div
      class="box flex-1 min-h-0 gap-4"
      data-testid={`report-part-${props.kind}`}
    >
      <PartFilters
        query={query()}
        status={status()}
        onQuery={(value) => {
          setQuery(value);
          setPage(0);
        }}
        onStatus={(value) => {
          setStatus(value);
          setPage(0);
        }}
      />
      <ScrollView class="flex-1" contentClass="gap-6">
        <PartAvailability parts={parts()} message={absent()} />
        <Show
          when={parts().length > 0}
          fallback={
            <EmptyState
              title={
                props.unavailable
                  ? t`Evidence unavailable`
                  : t`Evidence not recorded`
              }
              body={absent()}
            />
          }
        >
          <Show
            when={filtered().length > 0}
            fallback={
              <ChecksEmpty
                onClear={() => {
                  setQuery('');
                  setStatus('all');
                  setPage(0);
                }}
              />
            }
          >
            <For each={groups()}>
              {(part) => (
                <PartChecks
                  part={part}
                  checks={visible()
                    .filter((row) => row.part === part)
                    .map((row) => row.check)}
                  onOpen={props.onOpen}
                  canOpen={props.canOpen}
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
          </Show>
        </Show>
        <Show when={props.kind === 'performance'}>
          <Notice>{t`Recorded action timing includes harness work and waits. It is diagnostic evidence; browser paint and release performance obligations are checked separately.`}</Notice>
        </Show>
      </ScrollView>
    </div>
  );
}

function useParts(props: ReportPartsViewProps) {
  const state = usePartPage(
    () => props.parts,
    () => props.kind
  );
  bindPartQuery(
    () => props.initialQuery,
    (value) => {
      state.setQuery(value);
      state.setPage(0);
    }
  );
  return state;
}

function useAbsentMessage(
  kind: () => string,
  unavailable: () => boolean | undefined
) {
  const { t } = useLingui();
  return () =>
    unavailable()
      ? t`Evidence could not be read. Refresh to try again; the outcome of missing checks is unknown.`
      : kind() === 'ui-quality'
        ? t`The UI quality check has not been completed for this version. Run the UI quality check independently to add its evidence.`
        : kind() === 'performance'
          ? t`No completed performance check is recorded for this version. Run a performance report independently to add measured evidence.`
          : t`No completed report part is recorded for this version.`;
}

function usePartPage(
  allParts: () => readonly ReportPart[],
  kind: () => string
) {
  const [query, setQuery] = createSignal('');
  const [status, setStatus] = createSignal('all');
  const [page, setPage] = createSignal(0);
  const parts = createMemo(() =>
    allParts().filter((part) => part.kind === kind())
  );
  const filtered = createMemo(() =>
    parts().flatMap((part) =>
      part.checks
        .filter(
          (check) =>
            (status() === 'all' || status() === check.status) &&
            `${check.title} ${check.detail} ${check.specPath ?? ''}`
              .toLowerCase()
              .includes(query().trim().toLowerCase())
        )
        .map((check) => ({ part, check }))
    )
  );
  const pageCount = () => Math.ceil(filtered().length / PAGE_SIZE);
  const pageIndex = () => Math.min(page(), Math.max(0, pageCount() - 1));
  const visible = createMemo(() =>
    filtered().slice(pageIndex() * PAGE_SIZE, (pageIndex() + 1) * PAGE_SIZE)
  );
  const groups = createMemo(() => [
    ...new Set(visible().map((row) => row.part)),
  ]);
  return {
    query,
    setQuery,
    status,
    setStatus,
    setPage,
    parts,
    filtered,
    pageCount,
    pageIndex,
    visible,
    groups,
  };
}

function ChecksEmpty(props: { onClear: () => void }) {
  const { t } = useLingui();
  return (
    <EmptyState
      variant="compact"
      title={t`No checks match`}
      action={{ label: t`Clear filters`, onClick: props.onClear }}
    />
  );
}

function PartFilters(props: {
  query: string;
  status: string;
  onQuery: (value: string) => void;
  onStatus: (value: string) => void;
}) {
  const { t } = useLingui();
  return (
    <FilterBar
      value={props.query}
      onChange={props.onQuery}
      label={t`Find checks`}
    >
      <Select
        label={t`Outcome`}
        value={props.status}
        onValueChange={props.onStatus}
        options={[
          { value: 'all', label: t`All outcomes` },
          { value: 'failed', label: t`Failed` },
          { value: 'passed', label: t`Passed` },
          { value: 'running', label: t`Running` },
          { value: 'not-run', label: t`Not run` },
        ]}
      />
    </FilterBar>
  );
}

function bindPartQuery(
  query: () => string | undefined,
  set: (value: string) => void
) {
  createEffect(on(query, (value) => set(value ?? '')));
}

function PartAvailability(props: {
  parts: readonly ReportPart[];
  message: string;
}) {
  return (
    <Show
      when={
        props.parts.length > 0 &&
        props.parts.every((part) => partStatus(part) === 'not-run')
      }
    >
      <Notice>{props.message}</Notice>
    </Show>
  );
}
