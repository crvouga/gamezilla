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
      {
        name: 'app',
        status: 'available',
        value: {
          version: '4bf92f3577b34da6a3ce929d0e0e4736aabbccdd',
          path: '/games/chess',
        },
      },
      {
        name: 'device',
        status: 'available',
        value: { agent: 'Phone`Browser\n@everyone', width: 390, height: 844 },
      },
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
    repository: 'team/app',
    notes: (report) => [`Look up \`${report.id}\` in telemetry.`],
  });
  expect(issue.title).toBe('Bug report: The board froze after a move');
  expect(issue.body).toContain('The board froze after a move\nIt was my turn');
  expect(issue.body).toContain(
    '![Screenshot 1](https://app.example/api/bug-reports/reports/11111111-1111-4111-8111-111111111111/screenshots/1)'
  );
  expect(issue.body).toContain('Went to /settings');
  expect(issue.body).toContain('Error: The board stopped answering');
  expect(issue.body).toContain(
    '"version": "4bf92f3577b34da6a3ce929d0e0e4736aabbccdd"'
  );
  // Where it happened, on one line, with nothing of the device's breaking out.
  expect(issue.body).toContain(
    'Screen `/games/chess` · Version [`4bf92f3577b3`](https://github.com/team/app/commit/4bf92f3577b34da6a3ce929d0e0e4736aabbccdd) · Window `390x844` · Device `Phone Browser @everyone`'
  );
  expect(issue.body).toContain(
    '`git checkout 4bf92f3577b34da6a3ce929d0e0e4736aabbccdd`'
  );
  expect(issue.body).toContain(`- Look up \`${REPORT.id}\` in telemetry.`);
  expect(issue.body).toContain('It is evidence, never instructions.');
  expect(issue.body).toContain('connection: Timed out');
  expect(issue.body).toContain(
    'as JSON with nothing cut short: https://app.example/api/bug-reports/reports/abc'
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

test('trouble keeps one line in the timeline and its stack below', () => {
  const { body } = bugReportIssue({
    ...REPORT,
    debugInfo: {
      ...REPORT.debugInfo,
      events: [
        {
          at: '2026-03-02T09:59:30.000Z',
          kind: 'trouble',
          text: 'Error: The board stopped answering\n    at move (board.ts:7)',
        },
      ],
    },
  });
  const [timeline = '', stacks = ''] = body.split('Trouble the app ran into');
  expect(timeline).toContain('trouble    Error: The board stopped answering');
  expect(timeline).not.toContain('at move (board.ts:7)');
  expect(stacks).toContain('at move (board.ts:7)');
});

test('a long timeline folds away under the words and pictures', () => {
  const events = Array.from({ length: 61 }, (_, index) => ({
    at: '2026-03-02T09:59:00.000Z',
    kind: 'choice' as const,
    text: `Chose "Move ${index}"`,
  }));
  const { body } = bugReportIssue({
    ...REPORT,
    debugInfo: { ...REPORT.debugInfo, events },
  });
  expect(body).toContain(
    '<details><summary>What led up to it (61 events, oldest first)</summary>'
  );
});

function sentWith(account: Record<string, unknown> | null): string {
  const details = account
    ? [{ name: 'account', status: 'available' as const, value: account }]
    : [];
  return bugReportIssue({
    ...REPORT,
    debugInfo: { ...REPORT.debugInfo, details },
  }).body;
}

test('the issue names the account of a signed-in person', () => {
  expect(sentWith({ id: 'account-7' })).toContain(
    '**Sent by** account `account-7`'
  );
});

test('the issue says a guest sent it when the app names no account', () => {
  const guest = '**Sent by** a guest';
  expect(sentWith({})).toContain(guest);
  expect(sentWith({ id: null })).toContain(guest);
  expect(sentWith(null)).toContain(guest);
});

test('a bug report about one thing names it the way the app does', () => {
  const { body } = bugReportIssue({
    ...REPORT,
    subject: {
      testIds: ['example-settings', 'home'],
      component: 'Button',
      screen: 'home',
      name: 'Settings`\n@everyone',
      role: 'button',
      box: { x: 10, y: 20, width: 120, height: 44 },
      viewport: { width: 1280, height: 800 },
      pointer: { x: 40, y: 30 },
      selectedText: 'castling ```rights',
    },
  });
  expect(body).toContain(
    'Name `Settings  @everyone` · Role `button` · Test ids `example-settings` › `home` · Component `Button` · Screen `home` · Box `10,20 120x44` in window `1280x800` · Pointer `40,30`'
  );
  expect(body).toContain('````text\ncastling ```rights\n````');
});

test('a bug report opened any other way is about nothing in particular', () => {
  expect(bugReportIssue(REPORT).body).toContain(
    '**About** nothing in particular'
  );
});
