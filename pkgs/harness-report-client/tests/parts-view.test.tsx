import { expect, test } from 'bun:test';
import { ReportPartsView } from '@pkgs/harness-report-client/report-parts-view';
import type { ReportPart } from '@pkgs/harness-report-shared/explorer-types';
import { render } from 'solid-js/web';
import { TestProviders } from './test-providers';

test('unreadable evidence does not claim a quality check was unperformed', () => {
  // regression: reports-unavailable-hidden
  const host = document.createElement('div');
  const dispose = render(
    () => (
      <TestProviders>
        <ReportPartsView
          kind="ui-quality"
          unavailable
          parts={[]}
          onOpen={() => undefined}
          canOpen={() => false}
        />
      </TestProviders>
    ),
    host
  );
  try {
    expect(host.textContent).toContain('Evidence unavailable');
    expect(host.textContent).toContain('outcome of missing checks is unknown');
    expect(host.textContent).not.toContain('has not been completed');
  } finally {
    dispose();
  }
});

// regression: report-unbounded-parts
test('200 independent producers share one bounded page of checks', () => {
  const parts: ReportPart[] = Array.from({ length: 200 }, (_, producer) => ({
    sha: '1'.repeat(40),
    id: `counter-${producer}`,
    kind: 'performance',
    title: `Counter ${producer}`,
    recordedAtMs: 0,
    checks: Array.from({ length: 65 }, (_, check) => ({
      id: `check-${check}`,
      title: `Check ${check}`,
      status: 'passed',
      detail: '',
      measurements: [],
    })),
  }));
  const host = document.createElement('div');
  const dispose = render(
    () => (
      <TestProviders>
        <ReportPartsView
          kind="performance"
          parts={parts}
          onOpen={() => undefined}
          canOpen={() => false}
        />
      </TestProviders>
    ),
    host
  );
  try {
    expect(host.querySelectorAll('[data-component="MenuRow"]')).toHaveLength(
      64
    );
    expect(
      host.querySelector('[data-component="PaginationControls"]')
    ).not.toBeNull();
  } finally {
    dispose();
  }
});
