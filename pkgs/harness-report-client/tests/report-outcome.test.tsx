import { expect, test } from 'bun:test';
import { ReportOutcome } from '@pkgs/harness-report-client/report-outcome';
import { render } from 'solid-js/web';
import { TestProviders } from './test-providers';

test('failed completion is visible even without a failed individual test', () => {
  // regression: report-failed-producer-pass
  const host = document.createElement('div');
  const dispose = render(
    () => (
      <TestProviders>
        <ReportOutcome
          phase="complete"
          status="failed"
          hasFailingTests={false}
          runUrl="https://example.test/verification/42"
        />
      </TestProviders>
    ),
    host
  );
  try {
    expect(host.textContent).toContain('Failed');
    expect(host.textContent).toContain(
      'failed beyond its individual recorded test outcomes'
    );
    expect(host.querySelector('a')?.getAttribute('href')).toBe(
      'https://example.test/verification/42'
    );
  } finally {
    dispose();
  }
});
