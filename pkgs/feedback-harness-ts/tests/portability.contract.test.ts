import { expect, test } from 'bun:test';
import { startFeedbackRuntime } from '@pkgs/feedback-client-ts/feedback-runtime';
import { agentHandoff } from '@pkgs/feedback-server-ts/report-files';
import type { FeedbackReport } from '@pkgs/feedback-shared-ts/types';

const report: FeedbackReport = {
  schema: 'feedback.report/v2',
  id: 'portable-report',
  title: 'Portable feedback',
  kind: 'problem',
  body: {
    format: 'markdown',
    source: 'The host stopped.',
    sections: [{ heading: null, content: 'The host stopped.' }],
  },
  createdAt: '2026-10-01T00:00:00.000Z',
  status: 'open',
  authorId: 'another-app',
  diagnostics: [],
  recording: null,
  attachments: [],
};

test('feedback installs before an arbitrary host application starts', async () => {
  const order: string[] = [];
  const diagnostics = startFeedbackRuntime({
    installFeedback: () => order.push('feedback'),
    startApplication: async () => {
      order.push('application');
      throw new Error('host failed');
    },
  });
  await Promise.resolve();

  expect(order).toEqual(['feedback', 'application']);
  expect(diagnostics.provider.collect(new AbortController().signal)).toEqual([
    expect.objectContaining({
      source: 'bootstrap',
      message: expect.stringContaining('host failed'),
    }),
  ]);
});

test('agent handoff is independent of the host repository toolchain', () => {
  const handoff = agentHandoff(report);

  expect(handoff).toContain('host application');
  // The host's brand needs no entry: the handoff is this package's own text
  // plus the report's fields, and the host repository's brand policy refuses
  // every spelling of the brand in the package source.
  expect(handoff).not.toMatch(/spec-upsert|spec-implement|spec-audit/i);
});
