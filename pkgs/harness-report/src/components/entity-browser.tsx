import { createMemo, For, Show } from 'solid-js';

import {
  arrangeCatalog,
  type CatalogEntity,
  type CatalogGroup,
  type CatalogGroupView,
  type CatalogQuery,
  type CatalogSort,
  type CatalogStatus,
  catalogCounts,
} from '../lib/catalog';
import { fmtMs } from '../lib/format';

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

function label(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
    <div class="sr-toolbar sr-catalog">
      <input
        class="sr-search"
        type="search"
        placeholder="Search"
        aria-label="Search"
        value={props.query.q}
        onInput={(e) => set({ q: e.currentTarget.value })}
      />
      <select
        aria-label="Status"
        value={props.query.status}
        onChange={(e) =>
          set({ status: e.currentTarget.value as CatalogStatus })
        }
      >
        <For each={STATUSES}>
          {(status) => (
            <option value={status}>
              {`${label(status)} ${String(props.counts[status])}`}
            </option>
          )}
        </For>
      </select>
      <select
        aria-label="Group"
        value={props.query.group}
        onChange={(e) => set({ group: e.currentTarget.value as CatalogGroup })}
      >
        <For each={GROUPS}>
          {(group) => <option value={group}>{`Group: ${label(group)}`}</option>}
        </For>
      </select>
      <select
        aria-label="Sort"
        value={props.query.sort}
        onChange={(e) => set({ sort: e.currentTarget.value as CatalogSort })}
      >
        <For each={SORTS}>
          {(sort) => <option value={sort}>{`Sort: ${label(sort)}`}</option>}
        </For>
      </select>
    </div>
  );
}

function EntityRow(props: {
  entity: CatalogEntity;
  onOpen: (id: string) => void;
}) {
  const open = () => props.onOpen(props.entity.id);
  return (
    <div
      class="sr-row"
      role="link"
      tabindex="0"
      aria-label={`Open ${props.entity.title}`}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        open();
      }}
    >
      <span class={`sr-dot ${props.entity.status}`} />
      <div>
        <div class="title">{props.entity.title}</div>
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
      </div>
      <span class="dur">{fmtMs(props.entity.durationMs)}</span>
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
            <section class="sr-group">
              <Show when={props.query.group !== 'none'}>
                <div class="sr-group-head">
                  <h2>{group.name}</h2>
                  <span class="count">{groupSummary(group)}</span>
                </div>
              </Show>
              <For each={group.entities}>
                {(entity) => (
                  <EntityRow entity={entity} onOpen={props.onOpen} />
                )}
              </For>
            </section>
          </Show>
        )}
      </For>
    </div>
  );
}
