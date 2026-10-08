import { useLingui } from '@lingui/solid/macro';
import { catalogParams } from '@pkgs/harness-report-shared/catalog';
import type { HtmlReportTest } from '@pkgs/harness-root-shared/bundle';
import { Button } from '@pkgs/ui-root-client/button';
import { createMemo, Show } from 'solid-js';
import { useReport } from './report-context';
import type { ReportNav } from './use-report-nav';

function neighbor(
  tests: readonly HtmlReportTest[],
  testId: string,
  delta: number
): HtmlReportTest | null {
  const index = tests.findIndex((test) => test.report.meta.testId === testId);
  return tests[index + delta] ?? null;
}

/** Previous and next test inside this report, keeping the catalog filters. */
export function TestNav(props: { nav: ReportNav; testId: string }) {
  const { t } = useLingui();
  const report = useReport();
  const tests = () => report.data.tests;
  const index = createMemo(() =>
    tests().findIndex((test) => test.report.meta.testId === props.testId)
  );
  const prev = createMemo(() => neighbor(tests(), props.testId, -1));
  const next = createMemo(() => neighbor(tests(), props.testId, 1));
  const go = (id: string) =>
    props.nav.navigate({
      view: 'test',
      testId: id,
      params: catalogParams(props.nav.route().params),
    });
  const backToTests = () =>
    props.nav.navigate({
      view: 'list',
      params: catalogParams(props.nav.route().params),
    });

  return (
    <nav
      class="box flex-row flex-wrap items-center gap-2 px-3 py-2 bg-surface border-b border-border"
      aria-label={t`Tests`}
    >
      <Button
        title={t`Tests`}
        variant="ghost"
        intent="neutral"
        size="sm"
        onClick={backToTests}
      />
      <Button
        title={t`Previous test`}
        variant="outline"
        intent="neutral"
        size="sm"
        disabled={prev() === null}
        onClick={() => {
          const id = prev()?.report.meta.testId;
          if (id) go(id);
        }}
      />
      <span class="text textCaption textNumeral">
        {index() < 0 ? '—' : `${index() + 1} / ${tests().length}`}
      </span>
      <Button
        title={t`Next test`}
        variant="outline"
        intent="neutral"
        size="sm"
        disabled={next() === null}
        onClick={() => {
          const id = next()?.report.meta.testId;
          if (id) go(id);
        }}
      />
      <Show when={index() >= 0}>
        <span class="text textLabel flex-1 min-w-0 truncate">
          {tests()[index()]?.report.meta.title}
        </span>
      </Show>
    </nav>
  );
}
