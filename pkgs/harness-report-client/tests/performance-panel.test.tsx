import { expect, test } from 'bun:test';
import { PerformanceOverview } from '@pkgs/harness-report-client/performance-overview';
import { PerformancePanel } from '@pkgs/harness-report-client/performance-panel';
import { testFrames } from '@pkgs/harness-report-shared/frames';
import type { HtmlReportTest } from '@pkgs/harness-root-shared/bundle';
import { render } from 'solid-js/web';
import { exampleApp } from './example-app';

async function measuredReport(
  count: number,
  frames = true
): Promise<HtmlReportTest> {
  let elapsed = 0;
  await using s = await exampleApp().run({
    seed: 1,
    report: {
      frames,
      performance: { clock: { now: () => elapsed }, slowStepMs: 50 },
    },
  });
  for (let i = 0; i < count; i += 1) {
    await s.record(
      {
        kind: 'ui',
        title: `Press ${i + 1}`,
        actorId: 'alice',
        selector: 'counter',
      },
      async () => {
        elapsed += i === 0 ? 80 : 50;
      }
    );
  }
  return { report: s.report()!, blobs: {} };
}

test('heatmap allowance changes preserve precision and the selected recorded moment', async () => {
  const report = await measuredReport(2);
  const host = document.createElement('div');
  document.body.appendChild(host);
  let selected = -1;
  const dispose = render(
    () => (
      <PerformancePanel
        report={report.report}
        frames={testFrames(report)}
        onSelect={(frame) => {
          selected = frame.index;
        }}
      />
    ),
    host
  );
  try {
    expect(
      host.querySelectorAll(
        '[data-heat="slow"][data-testid="performance-cell"]'
      )
    ).toHaveLength(1);
    expect(host.textContent).toContain('80.00 ms');
    host
      .querySelector<HTMLButtonElement>('[data-testid="performance-cell"]')!
      .click();
    expect(selected).toBe(0);
    const input = host.querySelector<HTMLInputElement>('input')!;
    input.value = '80';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(
      host.querySelectorAll(
        '[data-heat="slow"][data-testid="performance-cell"]'
      )
    ).toHaveLength(0);
    expect(selected).toBe(0);
    input.value = '0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(input.value).toBe('0');
    expect(
      host.querySelectorAll(
        '[data-heat="slow"][data-testid="performance-cell"]'
      )
    ).toHaveLength(0);
  } finally {
    dispose();
    host.remove();
  }
});

test('large reports bound heatmap DOM size and disable steps without recorded moments', async () => {
  const report = await measuredReport(260, false);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const dispose = render(
    () => (
      <PerformancePanel
        report={report.report}
        frames={[]}
        onSelect={() => {
          throw new Error('no moment');
        }}
      />
    ),
    host
  );
  try {
    expect(
      host.querySelectorAll('[data-testid="performance-cell"]')
    ).toHaveLength(128);
    expect(
      host.querySelector<HTMLButtonElement>('[data-testid="performance-cell"]')!
        .disabled
    ).toBe(true);
    const later = [...host.querySelectorAll('button')].find(
      (button) => button.textContent === 'Later'
    )!;
    later.click();
    later.click();
    expect(
      host.querySelectorAll('[data-testid="performance-cell"]')
    ).toHaveLength(4);
    expect(
      host.querySelector('[data-testid="performance-cell"]')!.textContent
    ).toBe('257');
  } finally {
    dispose();
    host.remove();
  }
});

test('the suite overview distinguishes measured runs from old reports and opens the selected run', async () => {
  const measured = await measuredReport(1);
  const meta = { ...measured.report.meta, testId: 'old' };
  delete meta.performance;
  const old = {
    ...measured,
    report: {
      ...measured.report,
      meta,
    },
  };
  const host = document.createElement('div');
  document.body.appendChild(host);
  let selected = '';
  const dispose = render(
    () => (
      <PerformanceOverview
        tests={[measured, old]}
        onOpen={(id) => {
          selected = id;
        }}
      />
    ),
    host
  );
  try {
    expect(host.textContent).toContain('1 / 2 runs measured');
    expect(host.querySelectorAll('[data-heat="unmeasured"]')).toHaveLength(1);
    expect(host.querySelectorAll('[data-heat="slow"]')).toHaveLength(1);
    host
      .querySelector<HTMLButtonElement>('[data-testid="performance-cell"]')!
      .click();
    expect(selected).toBe(measured.report.meta.testId);
  } finally {
    dispose();
    host.remove();
  }
});
