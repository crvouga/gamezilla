import type { HtmlReportTest, ReportSnapshotBlob } from '@pkgs/harness';
import { createMemo, For, Show } from 'solid-js';
import type { ReportNav } from '../app/use-report-nav';
import { blobHeading, formatBlobBody } from '../lib/format';
import type { FlatFrame, OrderedUiBlob } from '../lib/frames';
import { blobText, isUi, orderedUiBlobs } from '../lib/frames';
import { showPress } from '../lib/hash';
import { stateFrameHtml } from '../lib/html-frame';
import { PhonePanel } from './phone-panel';

function sameIds(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, i) => id === b[i]);
}

type Slot = OrderedUiBlob & { readonly html: string | null };

function stateSections(
  test: HtmlReportTest,
  frame: FlatFrame
): { heading: string; body: string }[] {
  const sections: { heading: string; body: string }[] = [];
  for (const blob of frame.frame.snapshots) {
    if (isUi(blob)) continue;
    const body = formatBlobBody(test, blob);
    if (body === '(missing)') continue;
    sections.push({ heading: blobHeading(blob), body });
  }
  return sections;
}

/** HTML of the step's recorded state. Quint steps always get one. */
function modelSlot(
  test: HtmlReportTest,
  frame: FlatFrame | null,
  uiCount: number
): Slot | null {
  if (frame === null) return null;
  if (frame.step.kind !== 'quint' && uiCount > 0) return null;
  const sections =
    frame.step.kind === 'quint' ? [] : stateSections(test, frame);
  const html = stateFrameHtml(frame, sections);
  const blob: ReportSnapshotBlob = {
    name: 'state',
    media: 'html',
    file: `inline/model-${String(frame.index)}.html`,
    nodeId: 'model',
  };
  return { nodeId: 'model', blob, stale: false, html };
}

function slotHtml(
  test: HtmlReportTest,
  slot: OrderedUiBlob
): string | null {
  if (slot.blob?.media !== 'html') return null;
  return blobText(test, slot.blob);
}

export function PhoneStage(props: {
  test: HtmlReportTest;
  selected: FlatFrame | null;
  nav: ReportNav;
  mode: 'single' | 'multi';
  node: string | null;
}) {
  const slots = createMemo((): Slot[] => {
    const ui = orderedUiBlobs(props.selected, props.test)
      .filter((slot) => slot.blob !== null)
      .map((slot) => ({ ...slot, html: slotHtml(props.test, slot) }));
    const model = modelSlot(props.test, props.selected, ui.length);
    if (ui.length === 0) return model ? [model] : [];
    return model ? [...ui, model] : ui;
  });
  const ids = createMemo(
    () => {
      const all = slots();
      if (props.mode === 'multi') return all.map((slot) => slot.nodeId);
      const one =
        all.find((slot) => slot.nodeId === (props.node || '')) ||
        all.find((slot) => slot.blob) ||
        all[0];
      return one ? [one.nodeId] : [];
    },
    [],
    { equals: sameIds }
  );
  const slotFor = (id: string) => slots().find((slot) => slot.nodeId === id);
  const hitFor = (id: string) => {
    const frame = props.selected;
    const hit = frame?.frame.hit;
    if (!hit || !showPress(props.nav.route()) || id === 'model') return null;
    const actor = frame.step.actorId;
    return !actor || actor === id ? hit : null;
  };

  return (
    <Show
      when={ids().length > 0}
      fallback={
        <div class="sr-nodata">
          {props.selected
            ? 'No snapshot in this frame'
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
              html={slotFor(id)?.html ?? null}
              stale={slotFor(id)?.stale ?? true}
              pending={
                slotFor(id)?.blob?.media === 'html' &&
                (slotFor(id)?.html ?? null) === null
              }
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
