import type {
  CatalogGroup,
  CatalogLayout,
  CatalogQuery,
  CatalogSort,
  CatalogStatus,
} from '@pkgs/harness-report-shared/catalog';
import { catalogParams } from '@pkgs/harness-report-shared/catalog';
import { testCatalogEntity } from '@pkgs/harness-report-shared/test-catalog-entity';
import { createMemo } from 'solid-js';
import { EntityBrowser } from './entity-browser';
import { PerformanceOverview } from './performance-overview';
import { useReport } from './report-context';
import type { ReportNav } from './use-report-nav';

const STATUSES = new Set<string>([
  'all',
  'passed',
  'failed',
  'skipped',
  'running',
]);
const GROUPS = new Set<string>([
  'none',
  'file',
  'status',
  'package',
  'runtime',
]);
const SORTS = new Set<string>(['recent', 'name', 'duration', 'status']);
const LAYOUTS = new Set<string>(['list', 'grid']);

function oneOf<T extends string>(
  value: string | undefined,
  allowed: ReadonlySet<string>,
  fallback: T
): T {
  return value !== undefined && allowed.has(value) ? (value as T) : fallback;
}

function queryOf(params: Readonly<Record<string, string>>): CatalogQuery {
  return {
    q: params['q'] ?? '',
    status: oneOf<CatalogStatus>(params['status'], STATUSES, 'all'),
    group: oneOf<CatalogGroup>(params['group'], GROUPS, 'package'),
    sort: oneOf<CatalogSort>(params['sort'], SORTS, 'status'),
    layout: oneOf<CatalogLayout>(params['layout'], LAYOUTS, 'list'),
  };
}

export function ListView(props: { nav: ReportNav }) {
  const report = useReport();
  const query = createMemo(() => queryOf(props.nav.route().params));
  const entities = createMemo(() => report.data.tests.map(testCatalogEntity));
  const write = (next: CatalogQuery) => {
    props.nav.navigate(
      {
        view: 'list',
        params: {
          q: next.q,
          status: next.status === 'all' ? '' : next.status,
          group: next.group === 'package' ? '' : next.group,
          sort: next.sort === 'status' ? '' : next.sort,
          layout: next.layout === 'list' ? '' : next.layout,
        },
      },
      true
    );
  };
  return (
    <>
      <PerformanceOverview
        tests={report.data.tests}
        onOpen={(id) =>
          props.nav.navigate({
            view: 'test',
            testId: id,
            params: catalogParams(props.nav.route().params),
          })
        }
      />
      <EntityBrowser
        entities={entities()}
        query={query()}
        onQuery={write}
        onOpen={(id) =>
          props.nav.navigate({
            view: 'test',
            testId: id,
            params: catalogParams(props.nav.route().params),
          })
        }
        empty={
          report.data.tests.length === 0
            ? 'No tests were reported.'
            : 'No tests match.'
        }
        pending={report.pending && report.data.tests.length === 0}
      />
    </>
  );
}
