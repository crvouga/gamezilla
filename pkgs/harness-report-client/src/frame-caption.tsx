import type { HtmlReportTest } from '@pkgs/harness-shared/bundle';
import { Show } from 'solid-js';

import { fmtMs } from '@pkgs/harness-report-shared/format';
import type { FlatFrame } from '@pkgs/harness-report-shared/frames';

function phaseTag(frame: FlatFrame): { label: string; kind: string } | null {
  if (frame.frame.hit) return { label: 'before action', kind: 'press' };
  if (frame.step.status === 'failed') return { label: 'failed', kind: 'fail' };
  return null;
}

/** What this frame shows: step, actor, target and when — above the stage. */
export function FrameCaption(props: {
  test: HtmlReportTest;
  frames: FlatFrame[];
  selected: FlatFrame | null;
}) {
  return (
    <div class="sr-caption" data-frame-meta="">
      <Show
        when={props.selected}
        fallback={<span class="muted">No frames captured</span>}
      >
        {(sel) => (
          <>
            <span class="k">{sel().step.kind}</span>
            <span class="title">{sel().step.title}</span>
            <Show when={sel().step.actorId}>
              {(id) => <span class="sr-badge">{id()}</span>}
            </Show>
            <Show when={sel().step.selector}>
              {(s) => <span class="sel">{s()}</span>}
            </Show>
            <Show when={phaseTag(sel())}>
              {(tag) => (
                <span class={`sr-tag ${tag().kind}`}>{tag().label}</span>
              )}
            </Show>
            <span class="grow" />
            <span class="muted" data-frame-time="">
              {`+${fmtMs(sel().frame.capturedAtMs - props.test.report.meta.startedAtMs)}`}
            </span>
            <span class="muted" data-frame-duration="">
              {fmtMs(sel().frame.durationMs)}
            </span>
            <span class="muted">
              {`frame ${sel().index + 1} / ${props.frames.length}`}
            </span>
          </>
        )}
      </Show>
    </div>
  );
}
