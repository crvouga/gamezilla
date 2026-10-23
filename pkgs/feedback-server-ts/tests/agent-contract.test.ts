import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { FakeIssueReporter } from '@pkgs/feedback-server-ts/fake-issue-reporter';
import { readFeedbackReport } from '@pkgs/feedback-shared-ts/read-report';
import { createFeedbackReporting } from '@pkgs/feedback-shared-ts/reporting';

test('the authoritative report has one canonical agent-readable shape', async () => {
  const { clock, timers } = createHarnessClock();
  const result = await createFeedbackReporting({
    reporter: new FakeIssueReporter(),
    clock,
    timers,
    createId: () => 'report-one',
    authorId: 'author-one',
  }).submit({
    kind: 'problem',
    title: '',
    body: '## What happened\n\nThe board froze.\n\n## What was expected\n\nThe move completes.',
  });
  const report = result.report as unknown as Record<string, unknown>;
  expect(report['schema']).toBe('feedback.report/v2');
  expect(report['body']).toEqual({
    format: 'markdown',
    source:
      '## What happened\n\nThe board froze.\n\n## What was expected\n\nThe move completes.',
    sections: [
      { heading: 'What happened', content: 'The board froze.' },
      { heading: 'What was expected', content: 'The move completes.' },
    ],
  });
  expect(report['title']).toBe('The board froze.');
  expect('description' in report).toBe(false);
});

test('older stored feedback is read without losing its agent context', () => {
  const report = readFeedbackReport({
    version: 1,
    id: 'report-one',
    kind: 'problem',
    title: 'Board movement',
    description: 'The board froze.',
    expected: 'The move completes.',
    reproductionSteps: '1. Move a piece',
    createdAt: '2026-10-01T00:00:00.000Z',
    status: 'open',
    diagnostics: [],
    recording: null,
    attachments: [],
  });
  expect(report.authorId).toBe('local');
  expect(report.body.sections).toEqual([
    { heading: 'What happened', content: 'The board froze.' },
    { heading: 'What was expected', content: 'The move completes.' },
    { heading: 'Reproduction steps', content: '1. Move a piece' },
  ]);
});
