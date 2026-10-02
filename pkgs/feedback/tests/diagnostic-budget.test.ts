import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock';
import { HttpIssueReporter } from '@pkgs/feedback/client';
import {
  createFeedbackReportHandler,
  FakeIssueReporter,
} from '@pkgs/feedback/server';
import { createFeedbackReporting } from '@pkgs/feedback/shared';

// regression: feedback-optional-context-budget
test('large optional context cannot make a useful report exceed the HTTP limit', async () => {
  const { clock, timers } = createHarnessClock();
  const destination = new FakeIssueReporter();
  const handler = createFeedbackReportHandler({
    reporter: destination,
    clock,
    allowedOrigin: 'http://local',
  });
  const reporter = new HttpIssueReporter({
    timers,
    endpoint: 'http://local/api/feedback',
    http: { fetch: (input, init) => handler(new Request(input, init)) },
  });
  const submitted = await createFeedbackReporting({
    reporter,
    clock,
    timers,
    createId: () => 'large-context',
    providers: Array.from({ length: 20 }, (_, i) => ({
      name: `context-${i}`,
      collect: () => '界'.repeat(20_000),
    })),
  }).submit({
    kind: 'problem',
    title: '',
    body: '界'.repeat(32_000),
  });
  expect(submitted.issue.id).toBe('large-context');
  expect(destination.reports.get('large-context')?.body.source).toHaveLength(
    32_000
  );
  expect(
    destination.reports
      .get('large-context')
      ?.diagnostics.some((d) => d.status === 'unavailable')
  ).toBe(true);
});
