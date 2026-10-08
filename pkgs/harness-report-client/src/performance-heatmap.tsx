import type { HeatBand } from '@pkgs/harness-report-shared/performance';
import { createMemo, createSignal, For, Show } from 'solid-js';

export type HeatCell = {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly band: HeatBand;
  readonly disabled?: boolean;
};
const PAGE_SIZE = 128;

export function PerformanceHeatmap(props: {
  cells: readonly HeatCell[];
  onSelect: (id: string) => void;
}) {
  const [requestedPage, setPage] = createSignal(0);
  const pages = createMemo(() =>
    Math.max(1, Math.ceil(props.cells.length / PAGE_SIZE))
  );
  const page = createMemo(() => Math.min(requestedPage(), pages() - 1));
  const visible = createMemo(() =>
    props.cells.slice(page() * PAGE_SIZE, (page() + 1) * PAGE_SIZE)
  );
  return (
    <div class="sr-performance-map" data-component="PerformanceHeatmap">
      <div class="sr-heatmap" aria-label="Performance heatmap">
        <For each={visible()}>
          {(cell) => (
            <button
              type="button"
              class="sr-heat-cell"
              data-heat={cell.band}
              data-testid="performance-cell"
              disabled={cell.disabled}
              title={cell.detail}
              aria-label={cell.detail}
              onClick={() => props.onSelect(cell.id)}
            >
              {cell.label}
              <Show when={cell.band === 'slow'}>
                <span aria-hidden="true"> !</span>
              </Show>
            </button>
          )}
        </For>
      </div>
      <Show when={pages() > 1}>
        <div class="sr-performance-controls">
          <button
            type="button"
            class="sr-navbtn"
            disabled={page() === 0}
            onClick={() => setPage(page() - 1)}
          >
            Earlier
          </button>
          <span>{`Page ${page() + 1} of ${pages()}`}</span>
          <button
            type="button"
            class="sr-navbtn"
            disabled={page() + 1 >= pages()}
            onClick={() => setPage(page() + 1)}
          >
            Later
          </button>
        </div>
      </Show>
      <p class="sr-performance-note">
        Blue: short · Amber: approaching allowance · Red / !: slow · Grey:
        unmeasured
      </p>
    </div>
  );
}
