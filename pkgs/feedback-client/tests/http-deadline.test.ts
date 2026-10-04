import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { HttpIssueReporter } from '@pkgs/feedback-client/http-issue-reporter';
import { createFeedbackBody } from '@pkgs/feedback-shared/report-body';
import type { FeedbackReport } from '@pkgs/feedback-shared/types';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';

// regression: feedback-http-ignores-abort
const report: FeedbackReport = {
  kind: 'problem',
  recording: null,
  attachments: [],
  schema: 'feedback.report/v2',
  id: 'hung-transport',
  title: 'Board froze',
  body: createFeedbackBody('After a move'),
  createdAt: '2026-09-30T00:00:00.000Z',
  status: 'open',
  authorId: 'local',
  diagnostics: [],
};

test('a transport or response body ignoring cancellation cannot trap reporting', async () => {
  await assertProperty(
    'feedback-reliability',
    fc.asyncProperty(fc.constantFrom('request', 'body'), async (hangAt) => {
      const { clock, timers } = createHarnessClock();
      const reporter = new HttpIssueReporter({
        endpoint: 'http://local/api/feedback',
        timers,
        http: {
          fetch: () =>
            hangAt === 'request'
              ? new Promise<Response>(() => {})
              : Promise.resolve(
                  new Response(new ReadableStream(), {
                    headers: { 'Content-Type': 'application/json' },
                  })
                ),
        },
      });
      const result = reporter.create(report).catch((error: unknown) => error);
      clock.advance(10_000);
      expect(await result).toEqual(new Error('Report destination timed out'));
      expect(clock.pendingOneShotCount()).toBe(0);
    })
  );
});
