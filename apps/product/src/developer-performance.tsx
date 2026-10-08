import { scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { PerformancePanel } from '@pkgs/harness-report-client/performance-panel';
import { testFrames } from '@pkgs/harness-report-shared/frames';
import { summarizePerformance } from '@pkgs/harness-root-shared/report-performance';
import { render } from 'solid-js/web';
import { recordedReport, shownMoment } from './developer-report';
import { tools } from './developer-tools-state';

export const provideMeasuredReport = scenarioAction({
  name: 'provideMeasuredReport',
  act: (s, kind: 'slow' | 'quick' | 'unmeasured') => {
    const state = tools(s);
    const test = recordedReport('passed');
    const steps = test.report.steps.map((step) => ({
      ...step,
      ...(kind === 'unmeasured'
        ? {}
        : {
            performance: {
              selfMs: kind === 'slow' ? 80 : 12,
              executionMs: kind === 'slow' ? 80 : 12,
              snapshotMs: 200,
            },
          }),
    }));
    state.report = {
      ...test,
      report: {
        steps,
        meta: {
          ...test.report.meta,
          ...(kind === 'unmeasured'
            ? {}
            : { performance: summarizePerformance(steps, 50) }),
        },
      },
    };
    state.route = { view: 'test', testId: test.report.meta.testId, params: {} };
  },
});

export const openPerformanceHeatmap = scenarioAction({
  name: 'openPerformanceHeatmap',
  act: (s) => {
    const state = tools(s);
    const report = state.report;
    if (report === null) throw new Error('Report missing');
    state.performanceHost?.remove();
    const host = document.createElement('div');
    document.body.appendChild(host);
    state.performanceHost = host;
    const dispose = render(
      () => (
        <PerformancePanel
          report={report.report}
          frames={testFrames(report)}
          onSelect={(frame) => {
            state.route = {
              ...state.route,
              params: { frame: String(frame.index + 1) },
            };
          }}
        />
      ),
      host
    );
    const panel = host.querySelector('details');
    if (panel !== null) panel.open = true;
    s.session.onDispose(() => {
      dispose();
      host.remove();
    });
  },
});

export const selectPerformanceStep = scenarioAction({
  name: 'selectPerformanceStep',
  act: (s) => {
    const cell = tools(s).performanceHost?.querySelector<HTMLButtonElement>(
      '[data-testid="performance-cell"]'
    );
    if (cell === undefined || cell === null) throw new Error('Heatmap missing');
    cell.click();
  },
});

export function performanceView(s: ProductHarness) {
  const host = tools(s).performanceHost;
  return {
    text: host?.textContent ?? '',
    slow:
      (host?.querySelector(
        '[data-testid="performance-hotspot"][data-heat="slow"]'
      ) ?? null) !== null,
    heatmap:
      (host?.querySelectorAll('[data-testid="performance-cell"]').length ?? 0) >
      0,
    unavailable:
      (host?.querySelector('[data-testid="performance-unavailable"]') ??
        null) !== null,
    moment: shownMoment(s),
  };
}
