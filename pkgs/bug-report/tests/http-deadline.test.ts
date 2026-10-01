import { expect, test } from 'bun:test';
import { HttpIssueReporter } from '@pkgs/bug-report/client';
import type { BugReport } from '@pkgs/bug-report/shared';
import { createHarnessClock } from '@pkgs/clock';
import { assertProperty, fc } from '@pkgs/property';

// regression: bug-report-http-ignores-abort
const report: BugReport = {
  version: 1,
  id: 'hung-transport',
  title: 'Board froze',
  description: 'After a move',
  createdAt: '2026-09-30T00:00:00.000Z',
  status: 'open',
  diagnostics: [],
};

test('a transport or response body ignoring cancellation cannot trap reporting', async () => {
  await assertProperty(
    'bug-report-reliability',
    fc.asyncProperty(fc.constantFrom('request', 'body'), async (hangAt) => {
      const { clock, timers } = createHarnessClock();
      const reporter = new HttpIssueReporter({
        endpoint: 'http://local/api/bug-reports',
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
