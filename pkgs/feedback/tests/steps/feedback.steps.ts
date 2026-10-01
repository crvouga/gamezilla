import { expect } from 'bun:test';
import {
  type FeedbackReportingWorld,
  feedbackAction,
  readFeedbackView,
  readReport,
} from '@pkgs/feedback/harness';
import type { FeedbackDraft, FeedbackKind } from '@pkgs/feedback/shared';
import { defineParameterType, stepsFor } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

defineParameterType({
  name: 'feedbackDetail',
  regexp:
    /what happened|what was expected|reproduction steps|a description|an improvement/,
  transformer: (value) => value,
});
defineParameterType({
  name: 'feedbackKind',
  regexp: /a feature request|a gap|polish/,
  transformer: (value) => value,
});
const { Given, When, Then } = stepsFor<Run<FeedbackReportingWorld>>();
const COMPLETE: FeedbackDraft = {
  kind: 'problem',
  description: 'Hint stays loading',
  expected: 'The hint appears',
  reproductionSteps: 'Open a puzzle and ask for a hint',
};
const describe = (w: Run<FeedbackReportingWorld>, draft: FeedbackDraft) =>
  w.apply(feedbackAction, { type: 'describe', draft });
const missing: Record<string, keyof FeedbackDraft> = {
  'what happened': 'description',
  'what was expected': 'expected',
  'reproduction steps': 'reproductionSteps',
  'a description': 'description',
  'an improvement': 'expected',
};
const kinds: Record<string, FeedbackKind> = {
  'a feature request': 'feature',
  'a gap': 'gap',
  polish: 'polish',
};
When('the team opens Support', (w) =>
  w.apply(feedbackAction, { type: 'open' })
);
Then(
  'the team can describe a bug, a feature request, a gap or polish',
  async (w) => {
    expect((await w.read(readFeedbackView)).kinds).toHaveLength(4);
  }
);
Given(
  'the team has described a bug saying {string} expecting {string} reproducing {string}',
  (w, description: string, expected: string, reproductionSteps: string) =>
    describe(w, { kind: 'problem', description, expected, reproductionSteps })
);
Given(
  'the team has described a bug without {feedbackDetail}',
  (w, detail: string) => describe(w, { ...COMPLETE, [missing[detail]!]: '' })
);
Given(
  'the team has described {feedbackKind} saying {string} improving {string}',
  (w, kind: string, description: string, expected: string) =>
    describe(w, {
      kind: kinds[kind]!,
      description,
      expected,
      reproductionSteps: '',
    })
);
Given('the team has described polish without a description', (w) =>
  describe(w, { ...COMPLETE, kind: 'polish', description: '' })
);
Given('the team has described a feature request without an improvement', (w) =>
  describe(w, { ...COMPLETE, kind: 'feature', expected: '' })
);
When('the team sends the feedback', (w) =>
  w.apply(feedbackAction, { type: 'send' })
);
Then(
  'the team is told to provide {feedbackDetail} before sending feedback',
  async (w, detail: string) => {
    expect(
      (await w.read(readFeedbackView)).errors[missing[detail]!]
    ).toBeTruthy();
  }
);
Then(
  'the local feedback includes what happened, what was expected and the reproduction steps',
  async (w) => {
    const report = await w.read(readReport);
    expect(report).toMatchObject(COMPLETE);
  }
);
Then(
  'the local feedback keeps its kind and intended improvement',
  async (w) => {
    const report = await w.read(readReport);
    expect(['feature', 'gap', 'polish']).toContain(report?.kind ?? '');
    expect(report?.expected).toBe('Make the last move easier to see');
  }
);
Then('no recording has started', async (w) => {
  const view = await w.read(readFeedbackView);
  expect(view.videoStarts).toBe(0);
  expect(view.recording?.phase).toBe('idle');
});
Given('the team is recording a reproduction', (w) =>
  w.apply(feedbackAction, { type: 'start' })
);
Given('the team has stopped a reproduction recording', (w) =>
  w.apply(feedbackAction, { type: 'record' })
);
Given("the team's device cannot record video", (w) =>
  w.apply(feedbackAction, { type: 'no-video' })
);
When('the team records a reproduction', (w) =>
  w.apply(feedbackAction, { type: 'record' })
);
When('the team stops recording', (w) =>
  w.apply(feedbackAction, { type: 'stop' })
);
When('the team discards the recording', (w) =>
  w.apply(feedbackAction, { type: 'discard' })
);
Then('the team can review the recording before sending feedback', async (w) => {
  const view = await w.read(readFeedbackView);
  expect(view.recording?.phase).toBe('ready');
  expect(view.text).toContain('Reproduction ready');
});
Then('the feedback has no recording', async (w) => {
  expect((await w.read(readFeedbackView)).recording?.recording).toBeNull();
});
Then('the reproduction steps are recorded', async (w) => {
  expect(
    (await w.read(readFeedbackView)).recording?.recording?.actions
  ).toHaveLength(2);
});
Then('the team is told video is unavailable', async (w) => {
  expect((await w.read(readFeedbackView)).text).toContain(
    'Video is unavailable'
  );
});
Then(
  'the local feedback includes the recording and its reproduction steps',
  async (w) => {
    const report = await w.read(readReport);
    expect(report?.recording?.actions).toHaveLength(2);
    expect(report?.recording?.initialContext).not.toHaveLength(0);
    expect(report?.reproductionSteps).toBe(COMPLETE.reproductionSteps);
    expect(report?.attachments).toHaveLength(1);
  }
);
