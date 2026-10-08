import type { FlatFrame } from '@pkgs/harness-report-shared/frames';
import {
  measuredMs,
  type PerformanceRow,
} from '@pkgs/harness-report-shared/performance';
import type { ReportStep } from '@pkgs/harness-root-shared/report-types';
import { For, Show } from 'solid-js';

export function PerformanceHotspots(props: {
  rows: readonly PerformanceRow[];
  frames: ReadonlyMap<ReportStep, FlatFrame>;
  onSelect: (frame: FlatFrame) => void;
}) {
  return (
    <div class="sr-performance-hotspots" data-component="PerformanceHotspots">
      <h4>Most expensive steps</h4>
      <table>
        <thead>
          <tr>
            <th>Step</th>
            <th>Own work</th>
            <th>Including children</th>
            <th>Snapshots</th>
          </tr>
        </thead>
        <tbody>
          <For each={props.rows.slice(0, 15)}>
            {(row) => (
              <tr data-heat={row.band} data-testid="performance-hotspot">
                <td>
                  <button
                    type="button"
                    disabled={!props.frames.has(row.step)}
                    onClick={() => {
                      const frame = props.frames.get(row.step);
                      if (frame !== undefined) props.onSelect(frame);
                    }}
                  >
                    <Show when={row.band === 'slow'}>
                      <strong class="sr-slow-flag">Slow · </strong>
                    </Show>
                    {row.step.title}
                  </button>
                  <Show when={row.step.actorId || row.step.selector}>
                    <div class="sr-performance-note">
                      {[row.step.actorId, row.step.selector]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  </Show>
                </td>
                <td>{measuredMs(row.step.performance!.selfMs)}</td>
                <td>{measuredMs(row.step.performance!.executionMs)}</td>
                <td>{measuredMs(row.step.performance!.snapshotMs)}</td>
              </tr>
            )}
          </For>
        </tbody>
      </table>
    </div>
  );
}
