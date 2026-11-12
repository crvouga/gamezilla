import { expect, test } from 'bun:test';
import { bugReportIssue } from '@pkgs/feedback-server-ts/issue-body';
import type { BugReport } from '@pkgs/feedback-shared-ts/types';

const REPORT: BugReport = {
  schema: 'bug-report/v1',
  id: '11111111-1111-4111-8111-111111111111',
  reporterId: '22222222-2222-4222-8222-222222222222',
  description: 'The board froze after a move\nIt was my turn',
  createdAt: '2026-03-02T10:00:00.000Z',
  debugInfo: {
    events: [
      {
        at: '2026-03-02T09:59:00.000Z',
        kind: 'navigation',
        text: 'Went to /settings',
      },
      {
        at: '2026-03-02T09:59:30.000Z',
        kind: 'trouble',
        text: 'Error: The board stopped answering',
      },
    ],
    details: [
      { name: 'app', status: 'available', value: { version: '1.4.0' } },
      { name: 'connection', status: 'unavailable', reason: 'Timed out' },
    ],
  },
  screenshots: [
    {
      contentType: 'image/png',
      size: 8,
      url: 'https://app.example/api/bug-reports/reports/11111111-1111-4111-8111-111111111111/screenshots/1',
    },
  ],
};

test('the issue carries the words, the pictures and the debug info', () => {
  const issue = bugReportIssue(REPORT, {
    reportUrl: 'https://app.example/api/bug-reports/reports/abc',
  });
  expect(issue.title).toBe('Bug report: The board froze after a move');
  expect(issue.body).toContain('The board froze after a move\nIt was my turn');
  expect(issue.body).toContain(
    '![Screenshot 1](https://app.example/api/bug-reports/reports/11111111-1111-4111-8111-111111111111/screenshots/1)'
  );
  expect(issue.body).toContain('Went to /settings');
  expect(issue.body).toContain('Error: The board stopped answering');
  expect(issue.body).toContain('"version": "1.4.0"');
  expect(issue.body).toContain('connection: Timed out');
  expect(issue.body).toContain(
    'Full report for reproducing: https://app.example/api/bug-reports/reports/abc'
  );
});

test('what a person wrote cannot break out of its fence', () => {
  const description =
    'Look\n```\n</details>\n@everyone ![x](https://evil.example/pixel)\n````';
  const { body } = bugReportIssue({ ...REPORT, description });
  const fence = '`````';
  const opened = body.indexOf(`${fence}text\n`);
  const closed = body.indexOf(`\n${fence}\n`, opened);
  expect(opened).toBeGreaterThan(-1);
  expect(body.slice(opened, closed)).toContain(description);
});

test('an issue never grows past what GitHub accepts, and keeps the newest events', () => {
  const events = Array.from({ length: 300 }, (_, index) => ({
    at: '2026-03-02T09:59:00.000Z',
    kind: 'trouble' as const,
    text: `${index} ${'s'.repeat(3900)}`,
  }));
  const { body } = bugReportIssue({
    ...REPORT,
    description: 'd'.repeat(4000),
    debugInfo: {
      events,
      details: [
        { name: 'big', status: 'available', value: 'v'.repeat(60_000) },
      ],
    },
  });
  expect(body.length).toBeLessThanOrEqual(65_536);
  expect(body).toContain('earlier lines left out');
  expect(body).toContain('trouble    299 ');
  expect(body).not.toContain('trouble    0 ');
  expect(body).toContain(`Bug report \`${REPORT.id}\``);
});
