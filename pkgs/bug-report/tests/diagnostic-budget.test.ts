import { expect, test } from 'bun:test';
import { HttpIssueReporter } from '@pkgs/bug-report/client';
import { createBugReportHandler } from '@pkgs/bug-report/server';
import { createBugReporting, FakeIssueReporter } from '@pkgs/bug-report/shared';
import { createHarnessClock } from '@pkgs/clock';

// regression: bug-report-optional-context-budget
test('large optional context cannot make a useful report exceed the HTTP limit', async () => {
  const { clock, timers } = createHarnessClock();
  const destination = new FakeIssueReporter();
  const handler = createBugReportHandler({
    reporter: destination,
    clock,
    allowedOrigin: 'http://local',
  });
  const reporter = new HttpIssueReporter({
    timers,
    endpoint: 'http://local/api/bug-reports',
    http: { fetch: (input, init) => handler(new Request(input, init)) },
  });
  const submitted = await createBugReporting({
    reporter,
    clock,
    timers,
    createId: () => 'large-context',
    providers: Array.from({ length: 20 }, (_, i) => ({
      name: `context-${i}`,
      collect: () => '界'.repeat(20_000),
    })),
  }).submit({ title: 'Board freezes', description: '界'.repeat(32_000) });
  expect(submitted.issue.id).toBe('large-context');
  expect(destination.reports.get('large-context')?.description).toHaveLength(
    32_000
  );
  expect(
    destination.reports
      .get('large-context')
      ?.diagnostics.some((d) => d.status === 'unavailable')
  ).toBe(true);
});
