/** Shared search, filter, group and sort for reports and the tests inside one. */

export type CatalogStatus = 'all' | 'passed' | 'failed' | 'skipped' | 'running';

export type CatalogGroup = 'none' | 'file' | 'status' | 'package' | 'runtime';

export type CatalogSort = 'recent' | 'name' | 'duration' | 'status';

export type CatalogLayout = 'list' | 'grid';

export type CatalogQuery = {
  readonly q: string;
  readonly status: CatalogStatus;
  readonly group: CatalogGroup;
  readonly sort: CatalogSort;
  readonly layout: CatalogLayout;
};

export type CatalogEntity = {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly durationMs: number | null;
  /** Group label for `file` (a source file, or a branch). */
  readonly file: string;
  readonly packageName: string;
  readonly runtime: string;
  /** One muted line under the title: a failure, or a date. */
  readonly detail: string;
  readonly search: string;
  readonly href: string | null;
};

export type CatalogGroupView = {
  readonly name: string;
  readonly durationMs: number;
  readonly failed: number;
  readonly entities: readonly CatalogEntity[];
};

const STATUS_RANK: Readonly<Record<string, number>> = {
  failed: 0,
  running: 1,
  skipped: 2,
  passed: 3,
};

export function catalogCounts(
  entities: readonly CatalogEntity[]
): Record<CatalogStatus, number> {
  const counts: Record<CatalogStatus, number> = {
    all: entities.length,
    passed: 0,
    failed: 0,
    skipped: 0,
    running: 0,
  };
  for (const entity of entities) {
    if (
      entity.status === 'passed' ||
      entity.status === 'failed' ||
      entity.status === 'skipped' ||
      entity.status === 'running'
    ) {
      counts[entity.status] += 1;
    }
  }
  return counts;
}

function matches(entity: CatalogEntity, query: CatalogQuery): boolean {
  if (query.status !== 'all' && entity.status !== query.status) return false;
  const q = query.q.trim().toLowerCase();
  return q.length === 0 || entity.search.toLowerCase().includes(q);
}

function compare(
  a: CatalogEntity,
  b: CatalogEntity,
  sort: CatalogSort
): number {
  if (sort === 'duration') return (b.durationMs ?? -1) - (a.durationMs ?? -1);
  if (sort === 'status') {
    const rank = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (rank !== 0) return rank;
  }
  if (a.title < b.title) return -1;
  if (a.title > b.title) return 1;
  return 0;
}

function groupKey(entity: CatalogEntity, group: CatalogGroup): string {
  if (group === 'file') return entity.file || 'Other';
  if (group === 'status') return entity.status;
  if (group === 'package') return entity.packageName || 'Other';
  if (group === 'runtime') return entity.runtime || 'Other';
  return 'All';
}

function groupRank(name: string, group: CatalogGroup): number {
  if (group === 'status') return STATUS_RANK[name] ?? 9;
  return 0;
}

function compareGroups(
  a: CatalogGroupView,
  b: CatalogGroupView,
  group: CatalogGroup
): number {
  const rank = groupRank(a.name, group) - groupRank(b.name, group);
  if (rank !== 0) return rank;
  if (a.name === 'Other') return 1;
  if (b.name === 'Other') return -1;
  if (a.name < b.name) return -1;
  if (a.name > b.name) return 1;
  return 0;
}

const LIST_KEYS = [
  'q',
  'status',
  'group',
  'sort',
  'layout',
  'spec',
  'tab',
  'partq',
] as const;

/** The list's search params, dropped when a test route carries frame and zoom. */
export function catalogParams(
  params: Readonly<Record<string, string>>
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of LIST_KEYS) {
    const value = params[key];
    if (value) out[key] = value;
  }
  return out;
}

/** Filter, sort, then one group per chosen key. `recent` keeps input order. */
export function arrangeCatalog(
  entities: readonly CatalogEntity[],
  query: CatalogQuery
): readonly CatalogGroupView[] {
  const shown = entities.filter((entity) => matches(entity, query));
  const sorted =
    query.sort === 'recent'
      ? shown
      : [...shown].sort((a, b) => compare(a, b, query.sort));
  const order: string[] = [];
  const map = new Map<string, CatalogEntity[]>();
  for (const entity of sorted) {
    const key = groupKey(entity, query.group);
    const list = map.get(key);
    if (list === undefined) {
      map.set(key, [entity]);
      order.push(key);
    } else {
      list.push(entity);
    }
  }
  const groups = order.map((name) => {
    const list = map.get(name) ?? [];
    return {
      name,
      durationMs: list.reduce(
        (sum, entity) => sum + (entity.durationMs ?? 0),
        0
      ),
      failed: list.filter((entity) => entity.status === 'failed').length,
      entities: list,
    };
  });
  if (query.group === 'none') return groups;
  return [...groups].sort((a, b) => compareGroups(a, b, query.group));
}
