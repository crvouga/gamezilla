import { createMemo, For, Show } from 'solid-js';
import { useReport } from '../app/report-context';
import type { ReportNav } from '../app/use-report-nav';
import { fmtDate, fmtMs } from '../lib/format';

const FILTERS = ['all', 'passed', 'failed', 'skipped'] as const;

export function Header(props: { nav: ReportNav }) {
  const report = useReport();
  const isList = createMemo(() => props.nav.route().view === 'list');
  const status = createMemo(() => props.nav.route().params['status'] || 'all');
  const counts = createMemo(() => {
    const c = {
      all: report.data.tests.length,
      passed: 0,
      failed: 0,
      skipped: 0,
    };
    for (const t of report.data.tests) {
      const s = t.report.meta.status;
      if (s === 'passed' || s === 'failed' || s === 'skipped') c[s] += 1;
    }
    return c;
  });
  const totalDuration = createMemo(() =>
    report.data.tests.reduce((n, t) => n + (t.report.meta.durationMs || 0), 0)
  );

  return (
    <header class="sr-header">
      <Show when={!isList()}>
        <button
          type="button"
          class="sr-navbtn"
          onClick={() => props.nav.navigate({ view: 'list', params: {} })}
        >
          ← Tests
        </button>
      </Show>
      <a href="#/" aria-label="Back to report tests">
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
      <Show when={isList()}>
        <div class="sr-chips">
          <For each={[...FILTERS]}>
            {(f) => (
              <button
                type="button"
                class="sr-chip"
                classList={{ on: status() === f }}
                onClick={() =>
                  props.nav.navigate({
                    view: 'list',
                    params: {
                      ...props.nav.route().params,
                      status: f === 'all' ? '' : f,
                    },
                  })
                }
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}{' '}
                <b>{String(counts()[f] || 0)}</b>
              </button>
            )}
          </For>
        </div>
        <input
          class="sr-search"
          type="search"
          placeholder="Filter tests…"
          value={props.nav.route().params['q'] || ''}
          onInput={(e) => {
            const params = {
              ...props.nav.route().params,
              q: e.currentTarget.value,
            };
            props.nav.navigate({ view: 'list', params }, true);
          }}
        />
      </Show>
      <Show when={!isList()}>
        <span class="sr-keys">
          ← → frames · ↑ ↓ steps · N failures · Space play
        </span>
      </Show>
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
