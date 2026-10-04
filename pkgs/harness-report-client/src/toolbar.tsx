import {
  showAside,
  showPress,
  viewMode,
  zoomMode,
} from '@pkgs/harness-report-shared/hash';
import { For, Show } from 'solid-js';
import type { ReportNav } from './use-report-nav';

const ZOOMS = ['fit', '50', '75', '100'] as const;

/** View controls only; navigation lives in the scrubber transport. */
export function Toolbar(props: {
  nav: ReportNav;
  ui: boolean;
  hasData: boolean;
}) {
  const route = () => props.nav.route();
  return (
    <Show when={props.ui}>
      <div class="sr-toolbar">
        <div class="sr-seg" role="group" aria-label="Clients">
          <button
            type="button"
            classList={{ on: viewMode(route()) === 'multi' }}
            title="All clients (M)"
            onClick={() => props.nav.setParam('view', '')}
          >
            All clients
          </button>
          <button
            type="button"
            classList={{ on: viewMode(route()) === 'single' }}
            title="Focused client only (M)"
            onClick={() => props.nav.setParam('view', 'single')}
          >
            Focused
          </button>
        </div>
        <div class="sr-seg" role="group" aria-label="Zoom">
          <For each={[...ZOOMS]}>
            {(z) => (
              <button
                type="button"
                classList={{ on: zoomMode(route()) === z }}
                title="Zoom (F)"
                onClick={() => props.nav.setParam('zoom', z === 'fit' ? '' : z)}
              >
                {z === 'fit' ? 'Fit' : `${z}%`}
              </button>
            )}
          </For>
        </div>
        <span class="grow" />
        <button
          type="button"
          class="sr-navbtn"
          classList={{ on: showPress(route()) }}
          aria-pressed={showPress(route())}
          title="Highlight the pressed element (P)"
          onClick={() =>
            props.nav.setParam('press', showPress(route()) ? '0' : '')
          }
        >
          Highlight press
        </button>
        <Show when={props.hasData}>
          <button
            type="button"
            class="sr-navbtn"
            classList={{ on: showAside(route()) }}
            aria-pressed={showAside(route())}
            title="Show state snapshots (A)"
            onClick={() =>
              props.nav.setParam('aside', showAside(route()) ? '0' : '')
            }
          >
            State
          </button>
        </Show>
      </div>
    </Show>
  );
}
