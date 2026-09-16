import type { HtmlReportTest } from '@pkgs/sim';
import { createMemo, createSignal, For, Show } from 'solid-js';
import { fmtMs } from '../lib/format';
import type { FlatFrame } from '../lib/frames';
import { firstFrameFor, flattenSteps, lastFrameBefore } from '../lib/frames';

export function StepTree(props: {
  test: HtmlReportTest;
  frames: FlatFrame[];
  selected: FlatFrame | null;
  onSelect: (frame: FlatFrame | null) => void;
}) {
  const rows = createMemo(() =>
    flattenSteps(props.test.report.steps, [], 0, null)
  );
  const [collapsed, setCollapsed] = createSignal<Record<number, boolean>>({});

  const visible = (rowIndex: number): boolean => {
    const all = rows();
    let row = all[rowIndex];
    while (row?.parent) {
      if (collapsed()[row.parent.index]) return false;
      row = row.parent;
    }
    return true;
  };

  return (
    <div class="sr-steps">
      <For each={rows()}>
        {(row) => (
          <Show when={visible(row.index)}>
            <div
              class={`sr-step ${row.step.status}`}
              classList={{ sel: props.selected?.step === row.step }}
              style={{ 'padding-left': `${8 + row.depth * 16}px` }}
              data-step-row={String(row.index)}
              onClick={() => {
                const f =
                  firstFrameFor(row.step, props.frames) ||
                  lastFrameBefore(row.step, props.frames);
                props.onSelect(f);
              }}
            >
              <span
                class="tw"
                onClick={(e) => {
                  e.stopPropagation();
                  if ((row.step.steps || []).length === 0) return;
                  setCollapsed((c) => ({
                    ...c,
                    [row.index]: !c[row.index],
                  }));
                }}
              >
                {(row.step.steps || []).length > 0
                  ? collapsed()[row.index]
                    ? '▸'
                    : '▾'
                  : ''}
              </span>
              <span class={`sr-dot st ${row.step.status}`} />
              <div class="body">
                <div class="t">
                  <span class="k">{row.step.kind}</span>
                  {row.step.title}
                  <Show when={row.step.actorId}>
                    {(id) => (
                      <span class="sr-badge" style={{ 'margin-left': '6px' }}>
                        {id()}
                      </span>
                    )}
                  </Show>
                  <Show when={row.step.hit}>
                    <span class="hit-flag">● press</span>
                  </Show>
                </div>
                <Show when={row.step.selector}>
                  {(s) => <div class="sel-txt">{s()}</div>}
                </Show>
                <Show when={row.step.detail}>
                  {(d) => <div class="sel-txt">{d()}</div>}
                </Show>
                <Show when={row.step.error}>
                  {(err) => <div class="err">{err()}</div>}
                </Show>
              </div>
              <span class="d">{fmtMs(row.step.durationMs)}</span>
            </div>
          </Show>
        )}
      </For>
    </div>
  );
}
