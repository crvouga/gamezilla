import type { HtmlReportTest } from '@pkgs/sim';
import { For, Show } from 'solid-js';

import type { ReportNav } from '../app/report-app';
import { fmtMs } from '../lib/format';
import type { FlatFrame } from '../lib/frames';
import { frameHasUi } from '../lib/frames';
import { showAside, showPress } from '../lib/hash';

export function Toolbar(props: {
  test: HtmlReportTest;
  frames: FlatFrame[];
  selected: FlatFrame | null;
  nav: ReportNav;
}) {
  const idx = () => (props.selected ? props.selected.index : -1);
  const ui = () => frameHasUi(props.selected);
  const route = () => props.nav.route();

  const segOn = (cur: string | undefined, value: string, fallback: string) =>
    (cur || fallback) === value;

  return (
    <div class="sr-toolbar">
      <button
        type="button"
        class="sr-navbtn"
        disabled={idx() <= 0}
        data-scrub-prev=""
        onClick={() => props.nav.stepFrame(-1)}
      >
        ◂
      </button>
      <button
        type="button"
        class="sr-navbtn"
        disabled={idx() < 0 || idx() >= props.frames.length - 1}
        data-scrub-next=""
        onClick={() => props.nav.stepFrame(1)}
      >
        ▸
      </button>
      <span class="meta" data-frame-meta="">
        {props.selected
          ? `Frame ${idx() + 1} / ${props.frames.length} · ${props.selected.step.title}`
          : 'No frames'}
      </span>
      <Show when={props.selected}>
        {(sel) => (
          <span class="meta" data-frame-time="">
            {`+${fmtMs(sel().frame.capturedAtMs - props.test.report.meta.startedAtMs)}`}
          </span>
        )}
      </Show>
      <span class="grow" />
      <Show when={ui()}>
        <div class="sr-seg">
          <button
            type="button"
            class="tab"
            classList={{
              on: segOn(route().params['view'], 'multi', 'multi'),
            }}
            onClick={() => props.nav.setParam('view', '')}
          >
            Multi
          </button>
          <button
            type="button"
            class="tab"
            classList={{
              on: segOn(route().params['view'], 'single', 'multi'),
            }}
            onClick={() => props.nav.setParam('view', 'single')}
          >
            Single
          </button>
        </div>
        <div class="sr-seg">
          <For each={['fit', '50', '75', '100']}>
            {(z) => (
              <button
                type="button"
                class="tab"
                classList={{
                  on: segOn(route().params['zoom'], z, 'fit'),
                }}
                onClick={() => props.nav.setParam('zoom', z === 'fit' ? '' : z)}
              >
                {z === 'fit' ? 'Fit' : `${z}%`}
              </button>
            )}
          </For>
        </div>
        <button
          type="button"
          class="sr-navbtn"
          classList={{ on: showAside(route()) }}
          onClick={() =>
            props.nav.setParam('aside', showAside(route()) ? '0' : '')
          }
        >
          Snapshots
        </button>
        <button
          type="button"
          class="sr-navbtn"
          classList={{ on: showPress(route()) }}
          onClick={() =>
            props.nav.setParam('press', showPress(route()) ? '0' : '')
          }
        >
          Press
        </button>
      </Show>
      <span class="meta">
        <kbd>?</kbd> shortcuts
      </span>
    </div>
  );
}
