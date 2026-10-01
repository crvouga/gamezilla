import { expect } from 'bun:test';
import {
  editorAction,
  type FeedbackReportingWorld,
  feedbackAction,
  readEditorView,
} from '@pkgs/feedback/harness';
import { stepsFor } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

const { When, Then } = stepsFor<Run<FeedbackReportingWorld>>();
When('the team makes {string} a heading', (w, _text: string) =>
  w.apply(editorAction, { type: 'format', text: 'heading' })
);
Then(
  'the draft shows {string} as a heading while writing',
  async (w, text: string) => {
    expect((await w.read(readEditorView)).headings).toContain(text);
  }
);
When('the team writes feedback saying {string}', async (w, text: string) => {
  await w.apply(feedbackAction, { type: 'open' });
  await w.apply(editorAction, { type: 'write', text });
});
Then('the team is offered the polish template', async (w) => {
  expect((await w.read(readEditorView)).suggestions.join(' ')).toContain(
    '/polish'
  );
});
Then(
  'the team is not offered a template because no template matches',
  async (w) => {
    expect((await w.read(readEditorView)).suggestions).toEqual([]);
  }
);
When('the team chooses the suggested bug template', (w) =>
  w.apply(editorAction, { type: 'key', text: 'Enter' })
);
