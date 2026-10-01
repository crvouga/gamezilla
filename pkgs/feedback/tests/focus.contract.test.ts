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
      description: '',
      expected: '',
      reproductionSteps: '',
    },
  });
  await session.apply(feedbackAction, { type: 'send' });
  for (const [field, text] of [
    ['description', 'The board froze'],
    ['expected', 'The move appears'],
    ['steps', 'Drag e2 to e3'],
  ] as const) {
    await session.apply(editFeedbackAnswer, { field, text });
    expect(await session.read(readFeedbackAnswer, field)).toEqual({
      value: text,
      focused: true,
    });
  }
});
