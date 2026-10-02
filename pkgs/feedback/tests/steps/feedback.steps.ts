import { expect } from 'bun:test';
import {
  type FeedbackReportingWorld,
  feedbackAction,
  readFeedbackView,
  readReport,
} from '@pkgs/feedback/harness';
import type { FeedbackDraft } from '@pkgs/feedback/shared';
import { stepsFor } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

const { Given, When, Then } = stepsFor<Run<FeedbackReportingWorld>>();
const describe = (w: Run<FeedbackReportingWorld>, draft: FeedbackDraft) =>
  w.apply(feedbackAction, { type: 'describe', draft });
When('the team opens Support', (w) =>
  w.apply(feedbackAction, { type: 'open' })
);
Given(
  'the team has described a bug saying {string} expecting {string} reproducing {string}',
  (w, body: string, expected: string, steps: string) =>
    describe(w, {
      kind: 'problem',
      title: body,
      body: `## What happened\n${body}\n\n## What was expected\n${expected}\n\n## Reproduction steps\n${steps}`,
    })
);
When('the team sends the feedback', (w) =>
  w.apply(feedbackAction, { type: 'send' })
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
    expect(report?.body.source).toContain('Open a puzzle and ask for a hint');
    expect(report?.attachments).toHaveLength(1);
  }
);
