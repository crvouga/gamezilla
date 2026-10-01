import { createMemo, Show } from 'solid-js';
import { useReport } from '../app/report-context';
import type { ReportNav } from '../app/use-report-nav';
import { catalogParams } from '../lib/catalog';
import { fmtDate, fmtMs } from '../lib/format';
import { buildHash } from '../lib/hash';

export function Header(props: {
  nav: ReportNav;
  home: { readonly label: string; readonly onOpen: () => void } | undefined;
}) {
  const report = useReport();
  const isList = createMemo(() => props.nav.route().view === 'list');
  const totalDuration = createMemo(() =>
    report.data.tests.reduce((n, t) => n + (t.report.meta.durationMs || 0), 0)
  );
  const listHref = createMemo(() =>
    buildHash({
      view: 'list',
      params: catalogParams(props.nav.route().params),
    })
  );

  return (
    <header class="sr-header">
      <Show when={props.home}>
        {(home) => (
          <button
            type="button"
            class="sr-navbtn"
            onClick={() => home().onOpen()}
          >
            {`← ${home().label}`}
          </button>
        )}
      </Show>
      <Show when={!isList()}>
        <button
          type="button"
          class="sr-navbtn"
          onClick={() =>
            props.nav.navigate({
              view: 'list',
              params: catalogParams(props.nav.route().params),
            })
          }
        >
          ← Tests
        </button>
      </Show>
      <a href={listHref()} aria-label="Back to report tests">
        <h1>{report.data.title}</h1>
      </a>
      <span class="sr-meta">
        <span class={`sr-dot ${report.data.status}`} />
        {report.data.runId}
        {report.data.updatedAtMs
          ? ` · ${fmtDate(report.data.updatedAtMs)}`
          : ''}
        {` · ${fmtMs(totalDuration())}`}
      </span>
      <span class="sr-spacer" />
      <button
        type="button"
        class="sr-navbtn"
        title="Keyboard shortcuts"
        aria-label="Open keyboard shortcuts"
        onClick={() => props.nav.toggleHelp()}
      >
        ?
      </button>
    </header>
  );
}
