import { expect, test } from 'bun:test';
import {
  feedbackAction,
  feedbackReportingSystem,
  readFeedbackView,
  wizardAction,
} from '@pkgs/feedback/harness';

test('the composer is one writing surface without template controls', async () => {
  await using session = await feedbackReportingSystem.run({ seed: 424242 });
  await session.apply(feedbackAction, { type: 'open' });

  const view = await session.read(readFeedbackView);
  expect(view.buttons).not.toContain('Bug');
  expect(view.buttons).not.toContain('Feature request');
  expect(view.buttons).not.toContain('Gap');
  expect(view.buttons).not.toContain('Polish');
});

test('the feedback collection has no direct edit or delete mutations', async () => {
  await using session = await feedbackReportingSystem.run({ seed: 424242 });
  await session.apply(feedbackAction, {
    type: 'describe',
    draft: {
      kind: 'problem',
      title: 'Board movement',
      body: 'Pieces feel slow',
    },
  });
  await session.apply(feedbackAction, { type: 'send' });
  await session.apply(wizardAction, { type: 'manage' });

  const view = await session.read(readFeedbackView);
  expect(view.managementText).toContain('Board movement');
  expect(view.buttons).not.toContain('Edit report');
  expect(view.buttons).not.toContain('Delete');
});
