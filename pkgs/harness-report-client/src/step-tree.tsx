import type { HtmlReportTest } from '@pkgs/harness-shared/bundle';
import {
  createEffect,
  createMemo,
  createSelector,
  createSignal,
  For,
  Show,
} from 'solid-js';
import { actionLabel, fmtMs } from '@pkgs/harness-report-shared/format';
import type { FlatFrame } from '@pkgs/harness-report-shared/frames';
import {
  firstFrameFor,
  flattenSteps,
  lastFrameBefore,
  stepHasPress,
} from '@pkgs/harness-report-shared/frames';

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
  // O(1) row updates per selection change instead of re-checking every row.
  const isSelected = createSelector(() => props.selected?.step ?? null);
  let listEl: HTMLDivElement | undefined;

  createEffect(() => {
    const step = props.selected?.step;
    if (!step || !listEl) return;
    const index = rows().findIndex((r) => r.step === step);
    listEl
      .querySelector(`[data-step-row="${index}"]`)
      ?.scrollIntoView({ block: 'nearest' });
  });

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
    <div class="sr-steps" ref={listEl}>
      <For each={rows()}>
        {(row) => (
          <Show when={visible(row.index)}>
            <div
              class={`sr-step ${row.step.status}`}
              classList={{ sel: isSelected(row.step) }}
              style={{ 'padding-left': `${8 + row.depth * 16}px` }}
              data-step-row={String(row.index)}
              role="button"
              tabindex="0"
              aria-current={isSelected(row.step) ? 'true' : undefined}
              aria-label={`Select ${row.step.title}`}
              onClick={() => {
                const f =
                  firstFrameFor(row.step, props.frames) ||
                  lastFrameBefore(row.step, props.frames);
                props.onSelect(f);
              }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                const f =
                  firstFrameFor(row.step, props.frames) ||
                  lastFrameBefore(row.step, props.frames);
                props.onSelect(f);
              }}
            >
              <button
                type="button"
                class="tw"
                aria-label={
                  (row.step.steps || []).length > 0
                    ? `${collapsed()[row.index] ? 'Expand' : 'Collapse'} ${row.step.title}`
                    : undefined
                }
                disabled={(row.step.steps || []).length === 0}
                onClick={(e) => {
                  e.stopPropagation();
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
              </button>
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
                  <Show when={stepHasPress(row.step)}>
                    <span class="hit-flag">● press</span>
                  </Show>
                </div>
                <Show when={row.step.action}>
                  <div class="sel-txt">{actionLabel(row.step)}</div>
                </Show>
                <Show when={row.step.detail}>
                  {(detail) => <div class="detail">{detail()}</div>}
                </Show>
                <Show when={row.step.selector}>
                  {(s) => <div class="sel-txt">{s()}</div>}
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
