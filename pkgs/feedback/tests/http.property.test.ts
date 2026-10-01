import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock';
import { HttpIssueReporter } from '@pkgs/feedback/client';
import {
  createFeedbackReportHandler,
  FakeIssueReporter,
  GitHubIssueReporter,
} from '@pkgs/feedback/server';
import { createFeedbackReporting } from '@pkgs/feedback/shared';
import { assertProperty, fc } from '@pkgs/property';

const text = fc
  .string({ minLength: 1, maxLength: 100 })
  .filter((value) => value.trim().length > 0);
test('the same HTTP client creates reports through interchangeable backend destinations', async () => {
  await assertProperty(
    'feedback-reliability',
    fc.asyncProperty(text, fc.boolean(), async (description, useGithub) => {
      const { clock, timers } = createHarnessClock();
      const captured: unknown[] = [];
      const backend = useGithub
        ? new GitHubIssueReporter({
            token: 'server-only-token',
            repository: 'team/project',
            http: {
              async fetch(input, init) {
                expect(String(input)).toBe(
                  'https://api.github.com/repos/team/project/issues'
                );
                expect(new Headers(init?.headers).get('Authorization')).toBe(
                  'Bearer server-only-token'
                );
                captured.push(JSON.parse(String(init?.body)));
                return Response.json(
                  {
                    number: 17,
                    html_url: 'https://github.com/team/project/issues/17',
                  },
                  { status: 201 }
                );
              },
            },
          })
        : new FakeIssueReporter();
      const handler = createFeedbackReportHandler({
        reporter: backend,
        clock,
        allowedOrigin: 'http://local',
      });
      const frontend = new HttpIssueReporter({
        endpoint: 'http://local/api/feedback',
        timers,
        http: { fetch: (input, init) => handler(new Request(input, init)) },
      });
      const result = await createFeedbackReporting({
        reporter: frontend,
        clock,
        timers,
        createId: () => 'report-id',
        providers: [{ name: 'page', collect: () => ({ path: '/chess' }) }],
      }).submit({
        kind: 'problem',
        title: '',
        description,
      });
      expect(result.issue.id).toBe(useGithub ? '17' : 'report-id');
      expect(clock.pendingOneShotCount()).toBe(0);
      if (useGithub) expect(captured).toHaveLength(1);
      else
        expect(
          (backend as FakeIssueReporter).reports.get('report-id')?.description
        ).toBe(description);
    })
  );
});

test('invalid and foreign-origin HTTP requests cannot create issues', async () => {
  await assertProperty(
    'feedback-reliability',
    fc.asyncProperty(
      fc.constantFrom('origin', 'id', 'type', 'method', 'size'),
      async (kind) => {
        const reporter = new FakeIssueReporter();
        const handler = createFeedbackReportHandler({
          reporter,
          clock: { now: () => 0 },
          allowedOrigin: 'http://local',
        });
        const response = await handler(
          new Request('http://local/api/feedback', {
            method: kind === 'method' ? 'PUT' : 'POST',
            headers: {
              Origin:
                kind === 'origin' ? 'https://foreign.invalid' : 'http://local',
              'Content-Type':
                kind === 'type' ? 'text/plain' : 'application/json',
            },
            body: JSON.stringify({
              id: kind === 'id' ? '../../outside' : 'fixed',
              title: 'Board froze',
              description:
                kind === 'size'
                  ? 'x'.repeat(1_000_001)
                  : 'Stopped after a move',
            }),
          })
        );
        expect(response.status).toBeGreaterThanOrEqual(400);
        expect(reporter.reports.size).toBe(0);
      }
    )
  );
});
