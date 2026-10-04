import { expect, test } from 'bun:test';
import { feedbackAction, feedbackReportingSystem, readFeedbackView, wizardAction } from '@pkgs/feedback-harness/feedback';

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
  expect(view.buttons).not.toContain('Edit issue');
  expect(view.buttons).not.toContain('Delete issue');
});

test('issues follow list then create or detail hierarchy', async () => {
  await using session = await feedbackReportingSystem.run({ seed: 424242 });
  await session.apply(wizardAction, { type: 'manage' });

  let view = await session.read(readFeedbackView);
  expect(view.heading).toBe('Issues');
  expect(view.buttons).toContain('New issue');

  await session.apply(wizardAction, { type: 'new' });
  view = await session.read(readFeedbackView);
  expect(view.heading).toBe('New issue');
  expect(view.buttons).toContain('Issues');

  await session.apply(feedbackAction, {
    type: 'describe',
    draft: {
      kind: 'problem',
      title: 'Board movement',
      body: 'Pieces feel slow',
    },
  });
  await session.apply(feedbackAction, { type: 'send' });
  view = await session.read(readFeedbackView);
  expect(view.stage).toBe('read');
  expect(view.heading).toBe('Issue');
});

test('the issue composer keeps context actions inline', async () => {
  await using session = await feedbackReportingSystem.run({ seed: 424242 });
  await session.apply(feedbackAction, { type: 'open' });

  const view = await session.read(readFeedbackView);
  expect(view.hasContextScreen).toBe(false);
  expect(view.hasAttachControl).toBe(true);
  expect(view.hasRecordControl).toBe(true);
  expect(view.buttons).not.toContain('Add context');
});
