import { catalogParams } from '@pkgs/harness-report-shared/catalog';
import type { HtmlReportTest } from '@pkgs/harness-shared/bundle';
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
    <nav class="sr-testnav" aria-label="Tests">
      <button type="button" class="sr-navbtn" onClick={backToTests}>
        Tests
      </button>
      <button
        type="button"
        class="sr-navbtn"
        disabled={prev() === null}
        title={prev()?.report.meta.title ?? 'No previous test'}
        onClick={() => {
          const id = prev()?.report.meta.testId;
          if (id) go(id);
        }}
      >
        <span class="arrow">←</span>
        <span class="title">{prev()?.report.meta.title ?? 'Previous'}</span>
      </button>
      <span class="count">
        {index() < 0
          ? '—'
          : `${String(index() + 1)} / ${String(tests().length)}`}
      </span>
      <button
        type="button"
        class="sr-navbtn"
        disabled={next() === null}
        title={next()?.report.meta.title ?? 'No next test'}
        onClick={() => {
          const id = next()?.report.meta.testId;
          if (id) go(id);
        }}
      >
        <span class="title">{next()?.report.meta.title ?? 'Next'}</span>
        <span class="arrow">→</span>
      </button>
      <Show when={index() >= 0}>
        <span class="current">{tests()[index()]?.report.meta.title}</span>
      </Show>
    </nav>
  );
}
