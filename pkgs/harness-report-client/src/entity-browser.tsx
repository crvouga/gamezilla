import type {
  CatalogEntity,
  CatalogGroup,
  CatalogGroupView,
  CatalogLayout,
  CatalogQuery,
  CatalogSort,
  CatalogStatus,
} from '@pkgs/harness-report-shared/catalog';

import {
  arrangeCatalog,
  catalogCounts,
} from '@pkgs/harness-report-shared/catalog';
import { fmtMs } from '@pkgs/harness-report-shared/format';
import { createMemo, For, Show } from 'solid-js';
import type { TabOption } from './tab-picker';
import { TabPicker } from './tab-picker';

const STATUSES: readonly CatalogStatus[] = [
  'all',
  'failed',
  'passed',
  'skipped',
  'running',
];
const GROUPS: readonly CatalogGroup[] = [
  'package',
  'file',
  'status',
  'runtime',
  'none',
];
const SORTS: readonly CatalogSort[] = ['status', 'duration', 'name', 'recent'];
const LAYOUTS: readonly CatalogLayout[] = ['list', 'grid'];

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function options(values: readonly string[]): TabOption[] {
  return values.map((value) => ({ value, label: label(value) }));
}

function statusOptions(
  counts: Record<CatalogStatus, number>
): readonly TabOption[] {
  return STATUSES.map((status) => ({
    value: status,
    label: `${label(status)} ${String(counts[status])}`,
  }));
}

function groupSummary(group: CatalogGroupView): string {
  const tests = `${String(group.entities.length)}`;
  const failed = group.failed > 0 ? ` · ${String(group.failed)} failed` : '';
  return `${tests} · ${fmtMs(group.durationMs)}${failed}`;
}

function CatalogBar(props: {
  query: CatalogQuery;
  counts: Record<CatalogStatus, number>;
  onQuery: (next: CatalogQuery) => void;
}) {
  const set = (patch: Partial<CatalogQuery>) =>
    props.onQuery({ ...props.query, ...patch });
  return (
    <div class="sr-catalog">
      <input
        class="sr-search"
        type="search"
        placeholder="Search"
        aria-label="Search"
        value={props.query.q}
        onInput={(e) => set({ q: e.currentTarget.value })}
      />
      <div class="sr-catalog-row">
        <TabPicker
          label="Status"
          value={props.query.status}
          options={statusOptions(props.counts)}
          onPick={(status) => set({ status: status as CatalogStatus })}
        />
        <TabPicker
          label="Group"
          value={props.query.group}
          options={options(GROUPS)}
          onPick={(group) => set({ group: group as CatalogGroup })}
        />
        <TabPicker
          label="Sort"
          value={props.query.sort}
          options={options(SORTS)}
          onPick={(sort) => set({ sort: sort as CatalogSort })}
        />
        <TabPicker
          label="Layout"
          value={props.query.layout}
          options={options(LAYOUTS)}
          onPick={(layout) => set({ layout: layout as CatalogLayout })}
        />
      </div>
    </div>
  );
}

function openHandlers(entity: CatalogEntity, onOpen: (id: string) => void) {
  const open = () => onOpen(entity.id);
  return {
    open,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      open();
    },
  };
}

function EntityDetail(props: { entity: CatalogEntity }) {
  return (
    <Show when={props.entity.detail}>
      <div class="sub">
        <span>{props.entity.detail}</span>
        <Show when={props.entity.href}>
          {(href) => (
            <a
              href={href()}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
            >
              {' · run'}
            </a>
          )}
        </Show>
      </div>
    </Show>
  );
}

function EntityRow(props: {
  entity: CatalogEntity;
  onOpen: (id: string) => void;
}) {
  const act = openHandlers(props.entity, props.onOpen);
  return (
    <div
      class="sr-row"
      role="link"
      tabindex="0"
      aria-label={`Open ${props.entity.title}`}
      onClick={act.open}
      onKeyDown={act.onKeyDown}
    >
      <span class={`sr-dot ${props.entity.status}`} />
      <div>
        <div class="title">{props.entity.title}</div>
        <EntityDetail entity={props.entity} />
      </div>
      <span class="dur">{fmtMs(props.entity.durationMs)}</span>
    </div>
  );
}

function EntityCard(props: {
  entity: CatalogEntity;
  onOpen: (id: string) => void;
}) {
  const act = openHandlers(props.entity, props.onOpen);
  return (
    <div
      class={`sr-card ${props.entity.status}`}
      role="link"
      tabindex="0"
      aria-label={`Open ${props.entity.title}`}
      onClick={act.open}
      onKeyDown={act.onKeyDown}
    >
      <div class="top">
        <span class={`sr-dot ${props.entity.status}`} />
        <span class="title">{props.entity.title}</span>
      </div>
      <EntityDetail entity={props.entity} />
      <div class="meta">
        <span>{props.entity.packageName || props.entity.file}</span>
        <span class="dur">{fmtMs(props.entity.durationMs)}</span>
      </div>
    </div>
  );
}

export function CatalogSkeleton() {
  return (
    <div class="sr-group" aria-hidden="true">
      <For each={[0, 1, 2, 3, 4, 5]}>
        {() => (
          <div class="sr-row sr-skel">
            <span class="sr-dot" />
            <div class="title" />
            <span class="dur" />
          </div>
        )}
      </For>
    </div>
  );
}

function EntityGroup(props: {
  group: CatalogGroupView;
  query: CatalogQuery;
  onOpen: (id: string) => void;
}) {
  return (
    <section class="sr-group">
      <Show when={props.query.group !== 'none'}>
        <div class="sr-group-head">
          <h2>{props.group.name}</h2>
          <span class="count">{groupSummary(props.group)}</span>
        </div>
      </Show>
      <div class={props.query.layout === 'grid' ? 'sr-grid' : 'sr-rows'}>
        <For each={props.group.entities}>
          {(entity) => (
            <Show
              when={props.query.layout === 'grid'}
              fallback={<EntityRow entity={entity} onOpen={props.onOpen} />}
            >
              <EntityCard entity={entity} onOpen={props.onOpen} />
            </Show>
          )}
        </For>
      </div>
    </section>
  );
}

export function EntityBrowser(props: {
  entities: readonly CatalogEntity[];
  query: CatalogQuery;
  onQuery: (next: CatalogQuery) => void;
  onOpen: (id: string) => void;
  empty: string;
  pending: boolean;
}) {
  const groups = createMemo(() => arrangeCatalog(props.entities, props.query));
  const counts = createMemo(() => catalogCounts(props.entities));
  const visible = createMemo(() =>
    groups().some((group) => group.entities.length > 0)
  );
  return (
    <div class="sr-list">
      <CatalogBar
        query={props.query}
        counts={counts()}
        onQuery={props.onQuery}
      />
      <Show when={props.pending && props.entities.length === 0}>
        <CatalogSkeleton />
      </Show>
      <Show when={!props.pending && !visible()}>
        <div class="sr-note">{props.empty}</div>
      </Show>
      <For each={groups()}>
        {(group) => (
          <Show when={group.entities.length > 0}>
            <EntityGroup
              group={group}
              query={props.query}
              onOpen={props.onOpen}
            />
          </Show>
        )}
      </For>
    </div>
  );
}
