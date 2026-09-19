import type { HtmlReportTest } from '@pkgs/sim';
import { createMemo, For, Show } from 'solid-js';
import type { ReportNav } from '../app/use-report-nav';
import type { FlatFrame } from '../lib/frames';
import { orderedUiBlobs } from '../lib/frames';
import { showPress } from '../lib/hash';
import { PhonePanel } from './phone-panel';

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

export function PhoneStage(props: {
  test: HtmlReportTest;
  selected: FlatFrame | null;
  nav: ReportNav;
  mode: 'single' | 'multi';
  node: string | null;
}) {
  const slots = createMemo(() => orderedUiBlobs(props.selected, props.test));
  // Panels are keyed by actor id (strings), so scrubbing never remounts them:
  // each panel keeps its iframe and repaints in place.
  const ids = createMemo(
    () => {
      const all = slots();
      if (props.mode === 'multi') return all.map((s) => s.nodeId);
      const one =
        all.find((s) => s.nodeId === (props.node || '')) ||
        all.find((s) => s.blob) ||
        all[0];
      return one ? [one.nodeId] : [];
    },
    [],
    { equals: sameIds }
  );
  const slotFor = (id: string) => slots().find((s) => s.nodeId === id);
  const hitFor = (id: string) => {
    const frame = props.selected;
    const hit = frame?.frame.hit;
    if (!hit || !showPress(props.nav.route())) return null;
    const actor = frame.step.actorId;
    return !actor || actor === id ? hit : null;
  };

  return (
    <Show
      when={ids().length > 0}
      fallback={
        <div class="sr-nodata">
          {props.selected
            ? 'No UI snapshot in this frame'
            : 'This test captured no frames'}
        </div>
      }
    >
      <div
        class="sr-stage"
        classList={{
          single: props.mode === 'single',
          multi: props.mode === 'multi',
        }}
        aria-label={
          props.mode === 'multi' ? 'Client snapshots' : 'Client snapshot'
        }
      >
        <For each={ids()}>
          {(id) => (
            <PhonePanel
              test={props.test}
              blob={slotFor(id)?.blob ?? null}
              stale={slotFor(id)?.stale ?? true}
              nodeId={id}
              hit={hitFor(id)}
              zoom={props.nav.route().params['zoom'] || 'fit'}
              active={props.selected?.step.actorId === id}
              focused={id === (props.node || '')}
              onFocus={() => props.nav.goFrame(props.selected, id)}
            />
          )}
        </For>
      </div>
    </Show>
  );
}
