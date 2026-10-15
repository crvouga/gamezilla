import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { FakeIssueReporter } from '@pkgs/feedback-server/fake-issue-reporter';
import { createFeedbackReporting } from '@pkgs/feedback-shared/reporting';

// regression: feedback-markdown-title-property-assumes-raw-line
test('an empty Markdown heading keeps its fallback title when diagnostics fail', async () => {
  const reporter = new FakeIssueReporter();
  const { clock, timers } = createHarnessClock();
  const result = await createFeedbackReporting({
    reporter,
    clock,
    timers,
    createId: () => 'heading-regression',
    providers: [
      {
        name: 'throw',
        collect() {
          throw new Error('Context unavailable');
        },
      },
    ],
  }).submit({ kind: 'problem', title: '', body: '#  ' });
  expect(result.report.title).toBe('Bug report');
  expect(result.report.body.source).toBe('#  ');
  const enriched = await result.enriched;
  expect(enriched.title).toBe('Bug report');
  expect(enriched.body.source).toBe('#  ');
  expect(enriched.diagnostics[0]?.status).toBe('unavailable');
  expect(reporter.reports.get(result.issue.id)?.title).toBe('Bug report');
});
