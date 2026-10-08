import type { FlatFrame } from '@pkgs/harness-report-shared/frames';
import {
  measuredMs,
  performanceFrameIndex,
  performanceHotspots,
  performanceRows,
} from '@pkgs/harness-report-shared/performance';
import type { RunReport } from '@pkgs/harness-root-shared/report-types';
import { createMemo, createSignal, Show } from 'solid-js';
import { PerformanceHeatmap } from './performance-heatmap';
import { PerformanceHotspots } from './performance-hotspots';

export function PerformancePanel(props: {
  report: RunReport;
  frames: readonly FlatFrame[];
  onSelect: (frame: FlatFrame) => void;
}) {
  const [chosenAllowance, setAllowance] = createSignal<number>();
  const allowance = () =>
    chosenAllowance() ?? props.report.meta.performance?.slowStepMs ?? 50;
  const rows = createMemo(() =>
    performanceRows(props.report.steps, allowance())
  );
  const ranked = createMemo(() => performanceHotspots(rows()));
  const frameIndex = createMemo(() =>
    performanceFrameIndex(rows(), props.frames)
  );
  const cells = createMemo(() =>
    rows().map((row) => ({
      id: String(row.index),
      label: String(row.index + 1),
      band: row.band,
      detail: `${row.step.title}: ${row.step.performance === undefined ? 'unmeasured' : measuredMs(row.step.performance.selfMs)} own work${row.band === 'slow' ? ' · Slow' : ''}`,
      disabled: !frameIndex().has(row.step),
    }))
  );
  return (
    <details
      class="sr-performance"
      data-component="PerformancePanel"
      data-testid="performance-panel"
    >
      <summary>
        Performance heatmap{' '}
        <Show when={ranked().length > 0}>
          <span class="sr-badge">{`${rows().filter((r) => r.band === 'slow').length} slow steps`}</span>
        </Show>
      </summary>
      <Show
        when={ranked().length > 0}
        fallback={
          <p data-testid="performance-unavailable">
            Measurements are unavailable for this report. Run the suite with
            performance collection enabled.
          </p>
        }
      >
        <div class="sr-performance-controls">
          <label>
            Slow step allowance (ms){' '}
            <input
              type="number"
              min="1"
              step="1"
              value={allowance()}
              onInput={(event) => {
                const value = event.currentTarget.valueAsNumber;
                if (Number.isFinite(value) && value > 0) setAllowance(value);
              }}
            />
          </label>
        </div>
        <p class="sr-performance-note">
          Measured elapsed work includes waiting and harness work; it is not CPU
          time or browser input-to-paint latency. Own work excludes nested steps
          and their snapshots. Colours flag candidates for investigation.
        </p>
        <PerformanceHeatmap
          cells={cells()}
          onSelect={(id) => {
            const row = rows()[Number(id)];
            const frame =
              row === undefined ? undefined : frameIndex().get(row.step);
            if (frame !== undefined) props.onSelect(frame);
          }}
        />
        <PerformanceHotspots
          rows={ranked()}
          frames={frameIndex()}
          onSelect={props.onSelect}
        />
      </Show>
    </details>
  );
}
