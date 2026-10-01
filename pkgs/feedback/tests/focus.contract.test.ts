import { expect, test } from 'bun:test';
import {
  editFeedbackAnswer,
  feedbackAction,
  feedbackReportingSystem,
  readFeedbackAnswer,
} from '@pkgs/feedback/harness';

// regression: feedback-typing-steals-focus
test('typing in feedback answers retains focus', async () => {
  await using session = await feedbackReportingSystem.run({ seed: 424242 });
  await session.apply(feedbackAction, {
    type: 'describe',
    draft: {
      kind: 'problem',
      title: '',
      description: '',
    },
  });
  await session.apply(feedbackAction, { type: 'send' });
  for (const [field, text] of [
    ['description', 'The board froze'],
    ['title', 'Board movement'],
  ] as const) {
    await session.apply(editFeedbackAnswer, { field, text });
    expect(await session.read(readFeedbackAnswer, field)).toEqual({
      value: text,
      focused: true,
    });
  }
});
