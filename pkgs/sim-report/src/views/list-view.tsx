import type { HtmlReportTest } from '@pkgs/sim';
import { createMemo, For, Show } from 'solid-js';

import type { ReportNav } from '../app/report-app';
import { useReport } from '../app/report-context';
import { fileLabel, fmtMs } from '../lib/format';

function matchesFilter(
  t: HtmlReportTest,
  status: string | undefined,
  q: string
): boolean {
  if (status && t.report.meta.status !== status) return false;
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const m = t.report.meta;
  return [
    m.title,
    m.testId,
    m.sourceFile || '',
    fileLabel(m.sourceFile),
    m.system,
    m.runtime,
  ]
    .join(' ')
    .toLowerCase()
    .includes(query);
}

function groupTests(tests: readonly HtmlReportTest[]) {
  const map = new Map<string, HtmlReportTest[]>();
  const order: string[] = [];
  for (const t of tests) {
    const name = fileLabel(t.report.meta.sourceFile);
    if (!map.has(name)) {
      map.set(name, []);
      order.push(name);
    }
    map.get(name)?.push(t);
  }
  order.sort((a, b) => {
    if (a === 'Other') return 1;
    if (b === 'Other') return -1;
    return a < b ? -1 : a > b ? 1 : 0;
  });
  return order.map((name) => ({ name, tests: map.get(name) ?? [] }));
}

export function ListView(props: { nav: ReportNav }) {
  const report = useReport();
  const status = createMemo(() => props.nav.route().params['status'] || 'all');
  const q = createMemo(() => props.nav.route().params['q'] || '');
  const shown = createMemo(() =>
    report.data.tests.filter((t) =>
      matchesFilter(t, status() === 'all' ? undefined : status(), q())
    )
  );
  const groups = createMemo(() => groupTests(shown()));

  return (
    <div class="sr-list">
      <Show
        when={shown().length > 0}
        fallback={
          <div class="sr-empty">
            {report.data.tests.length === 0
              ? 'No tests were reported.'
              : 'No tests match.'}
          </div>
        }
      >
        <For each={groups()}>
          {(group) => {
            const failed = () =>
              group.tests.filter((t) => t.report.meta.status === 'failed')
                .length;
            return (
              <div class="sr-group">
                <div class="sr-group-head">
                  <h2>{group.name}</h2>
                  <span class="count">
                    {group.tests.length} test
                    {group.tests.length === 1 ? '' : 's'}
                    {failed() ? ` · ${failed()} failed` : ''}
                  </span>
                </div>
                <For each={group.tests}>
                  {(t) => {
                    const m = t.report.meta;
                    return (
                      <div
                        class="sr-row"
                        onClick={() =>
                          props.nav.navigate({
                            view: 'test',
                            testId: m.testId,
                            params: {},
                          })
                        }
                      >
                        <span class={`sr-dot ${m.status}`} />
                        <div>
                          <div class="title">{m.title}</div>
                          <div class="sub">
                            <span class="mono">{m.testId}</span>
                            <Show when={m.sourceLine}>
                              {(line) => <span>{` · L${line()}`}</span>}
                            </Show>
                            <Show when={m.error}>
                              {(err) => (
                                <span>{` · ${err().split('\n')[0]}`}</span>
                              )}
                            </Show>
                          </div>
                        </div>
                        <span class="sr-badge">
                          {m.runtime} · seed {m.seed}
                        </span>
                        <span class="dur">{fmtMs(m.durationMs)}</span>
                      </div>
                    );
                  }}
                </For>
              </div>
            );
          }}
        </For>
      </Show>
    </div>
  );
}
