import type { HtmlReportTest } from '@pkgs/harness';
import { createMemo } from 'solid-js';

import { useReport } from '../app/report-context';
import type { ReportNav } from '../app/use-report-nav';
import { EntityBrowser } from '../components/entity-browser';
import {
  type CatalogEntity,
  type CatalogGroup,
  catalogParams,
  type CatalogQuery,
  type CatalogSort,
  type CatalogStatus,
} from '../lib/catalog';
import { fileLabel } from '../lib/format';

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
  };
}

function packageOf(testId: string): string {
  const source = testId.split('/')[0] ?? '';
  const cut = source.indexOf('--');
  const name = cut < 0 ? source : source.slice(0, cut);
  return name.length > 0 ? name : 'report';
}

function toEntity(test: HtmlReportTest): CatalogEntity {
  const meta = test.report.meta;
  const file = fileLabel(meta.sourceFile);
  const packageName = packageOf(meta.testId);
  const error = meta.error?.split('\n')[0] ?? '';
  return {
    id: meta.testId,
    title: meta.title,
    status: meta.status,
    durationMs: meta.durationMs,
    file,
    packageName,
    runtime: meta.runtime,
    detail: error,
    search: [
      meta.title,
      meta.testId,
      meta.sourceFile ?? '',
      file,
      meta.system,
      meta.runtime,
      packageName,
      error,
    ].join(' '),
    href: null,
  };
}

export function ListView(props: { nav: ReportNav }) {
  const report = useReport();
  const query = createMemo(() => queryOf(props.nav.route().params));
  const entities = createMemo(() => report.data.tests.map(toEntity));
  const write = (next: CatalogQuery) => {
    props.nav.navigate(
      {
        view: 'list',
        params: {
          q: next.q,
          status: next.status === 'all' ? '' : next.status,
          group: next.group === 'package' ? '' : next.group,
          sort: next.sort === 'status' ? '' : next.sort,
        },
      },
      true
    );
  };
  return (
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
  );
}
