import { expect, test } from 'bun:test';
import {
  chooseToReport,
  describeBug,
  feedbackReportingSystem,
  readDescription,
} from '../src/feedback';

// regression: feedback-typing-steals-focus
test('writing a description keeps the person in the field they are writing in', async () => {
  await using session = await feedbackReportingSystem.run({ seed: 424242 });
  await session.apply(chooseToReport);
  const field = document.querySelector<HTMLTextAreaElement>(
    '[data-testid="bug-report-description"] textarea, textarea[data-testid="bug-report-description"]'
  );
  if (!field) throw new Error('No description field on screen');
  field.focus();
  for (const text of ['T', 'Th', 'The board froze']) {
    await session.apply(describeBug, text);
    expect(document.activeElement === field).toBe(true);
    expect(field.isConnected).toBe(true);
  }
  expect(await session.read(readDescription)).toBe('The board froze');
});
