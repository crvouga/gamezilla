import type { HtmlReportTest } from '@pkgs/harness-root-shared/bundle';
import type { CatalogEntity } from './catalog';
import { fileLabel } from './format';

function packageOf(testId: string): string {
  const source = testId.split('/')[0] ?? '';
  const cut = source.indexOf('--');
  const name = cut < 0 ? source : source.slice(0, cut);
  return name.length > 0 ? name : 'report';
}

export function testCatalogEntity(test: HtmlReportTest): CatalogEntity {
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
