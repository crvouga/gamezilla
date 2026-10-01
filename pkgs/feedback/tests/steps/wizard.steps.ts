import { expect } from 'bun:test';
import {
  changeForeignFeedback,
  type FeedbackReportingWorld,
  feedbackAction,
  foreignFeedback,
  readFeedbackView,
  readForeignRefusal,
  readReport,
  wizardAction,
} from '@pkgs/feedback/harness';
import { stepsFor } from '@pkgs/gherkin/registry';
import type { Run } from '@pkgs/harness';

const { Given, When, Then } = stepsFor<Run<FeedbackReportingWorld>>();
Given(
  'the team has a draft titled {string} saying {string}',
  async (w, title: string, body: string) => {
    await w.apply(wizardAction, { type: 'new' });
    await w.apply(feedbackAction, {
      type: 'describe',
      draft: { kind: 'problem', title, body },
    });
  }
);
Given('the team has opened the feedback wizard', (w) =>
  w.apply(feedbackAction, { type: 'open' })
);
Given('the team is using the app on a phone', (w) =>
  w.apply(wizardAction, { type: 'phone' })
);
Given(
  'feedback titled {string} belongs to another developer',
  (w, title: string) => w.apply(foreignFeedback, title)
);
When('the team returns to the wizard after closing it', (w) =>
  w.apply(wizardAction, { type: 'return' })
);
When("the team's app reopens after closing", (w) =>
  w.apply(wizardAction, { type: 'reopen' })
);
When('the team starts new feedback', (w) =>
  w.apply(wizardAction, { type: 'new' })
);
When('the team opens feedback from the command palette', (w) =>
  w.apply(wizardAction, { type: 'palette' })
);
When('the team closes the wizard', (w) =>
  w.apply(wizardAction, { type: 'close' })
);
When('the team moves the feedback widget out of the way', (w) =>
  w.apply(wizardAction, { type: 'move' })
);
When('the team chooses the bug template', (w) =>
  w.apply(wizardAction, { type: 'bug-template' })
);
When('the team chooses the polish template', (w) =>
  w.apply(wizardAction, { type: 'polish-template' })
);
When('the team opens feedback management', (w) =>
  w.apply(wizardAction, { type: 'manage' })
);
When('the team confirms deleting that feedback', (w) =>
  w.apply(wizardAction, { type: 'delete' })
);
When('the team cancels deleting that feedback', (w) =>
  w.apply(wizardAction, { type: 'cancel-delete' })
);
When(
  'the team changes that feedback to {string} saying {string}',
  (w, title: string, body: string) =>
    w.apply(wizardAction, { type: 'edit', title, body })
);
When('the team tries to change that feedback', (w) =>
  w.apply(changeForeignFeedback)
);
Then(
  'the draft is titled {string} saying {string}',
  async (w, title: string, body: string) => {
    expect((await w.read(readFeedbackView)).draft).toMatchObject({
      title,
      body,
    });
  }
);
Then('the draft includes {string}', async (w, text: string) => {
  expect((await w.read(readFeedbackView)).draft?.body).toContain(text);
});
Then('the feedback keeps the Markdown {string}', async (w, text: string) => {
  expect((await w.read(readReport))?.body.source).toBe(text);
});
Then(
  'the team is told to write something before sending feedback',
  async (w) => {
    expect((await w.read(readFeedbackView)).errors.body).toContain(
      'Write something'
    );
  }
);
Then(
  'the team is told the draft is kept until feedback can be sent',
  async (w) => {
    expect((await w.read(readFeedbackView)).text).toContain(
      'Draft kept on this device. Send it when reporting is available.'
    );
  }
);
Then(
  'the draft offers prompts for what happened, what was expected and reproduction steps',
  async (w) => {
    expect((await w.read(readFeedbackView)).draft?.body).toContain(
      '## Reproduction steps'
    );
  }
);
Then('the draft offers prompts for an intended improvement', async (w) => {
  expect((await w.read(readFeedbackView)).draft?.body).toContain(
    '## Intended improvement'
  );
});
Then('the team has one feedback wizard', async (w) => {
  expect((await w.read(readFeedbackView)).wizardCount).toBe(1);
});
Then('feedback takes no permanent place in the app', async (w) => {
  expect((await w.read(readFeedbackView)).permanentControl).toBe(false);
  expect((await w.read(readFeedbackView)).wizardCount).toBe(0);
});
Then('the feedback wizard is a full-width sheet', async (w) => {
  expect((await w.read(readFeedbackView)).sheet).toBe(true);
});
Then('the feedback widget has moved', async (w) => {
  expect((await w.read(readFeedbackView)).position?.x).toBeLessThan(0);
});
Then(
  'the change is refused because the feedback belongs to another developer',
  async (w) => {
    expect(await w.read(readForeignRefusal)).toBe(true);
  }
);
Then(
  'the team can find the draft {string} in feedback management',
  async (w, title: string) => {
    await w.apply(wizardAction, { type: 'manage' });
    expect((await w.read(readFeedbackView)).managementText).toContain(title);
    expect((await w.read(readFeedbackView)).managementText).toContain('Draft');
  }
);
Then('feedback management shows {string}', async (w, title: string) => {
  await w.apply(wizardAction, { type: 'manage' });
  expect((await w.read(readFeedbackView)).managementText).toContain(title);
});
Then(
  'feedback management shows {string} saying {string}',
  async (w, title: string, body: string) => {
    await w.apply(wizardAction, { type: 'manage' });
    const view = await w.read(readFeedbackView);
    expect(view.managementText).toContain(title);
    expect(view.managementText).toContain(body);
  }
);
Then('feedback management does not show {string}', async (w, title: string) => {
  expect((await w.read(readFeedbackView)).managementText).not.toContain(title);
});
