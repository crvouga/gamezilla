import { expect, test } from 'bun:test';
import {
  editorAction,
  feedbackAction,
  feedbackReportingSystem,
  navigationAction,
  readEditorView,
  readFeedbackView,
  readNavigationView,
  wizardAction,
} from '@pkgs/feedback/harness';

// regression: feedback-widget-unbounded
test('issues scroll in a fixed-height widget and stages move keyboard focus', async () => {
  await using session = await feedbackReportingSystem.run({ seed: 424242 });
  await session.apply(feedbackAction, {
    type: 'describe',
    draft: {
      kind: 'problem',
      title: 'Board movement',
      body: 'Pieces feel slow',
    },
  });
  await session.apply(wizardAction, { type: 'manage' });
  const list = await session.read(readNavigationView);
  expect(list.widgetClass).toContain('h-160');
  expect(list.listClass).toContain('overflow-y-auto');
  expect(list.listFocusable).toBe('0');
  expect(list.activeLabel).toBe('Search feedback');
  await session.apply(navigationAction, {
    type: 'open',
    text: 'Board movement',
  });
  expect((await session.read(readNavigationView)).activeLabel).toBe(
    'Edit issue'
  );
});

// regression: feedback-actions-hidden-menu
test('an issue exposes its two actions without opening a menu', async () => {
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
  const view = await session.read(readNavigationView);
  expect(view.directActions).toEqual(['Edit issue', 'Delete issue']);
  expect(view.menu).toBe(false);
});

// regression: feedback-icon-label-clipping
test('evidence icon labels float beyond the editor and appear on keyboard focus', async () => {
  await using session = await feedbackReportingSystem.run({ seed: 424242 });
  await session.apply(feedbackAction, { type: 'open' });
  await session.apply(navigationAction, {
    type: 'focus',
    text: 'Attach screenshot or video',
  });
  const view = await session.read(readNavigationView);
  const attachment = view.iconLabels.find(
    (item) => item.label === 'Attach screenshot or video'
  );
  expect(attachment).toMatchObject({ floating: true, visible: true });
  expect(attachment?.text).toContain('Attach screenshot or video');
});

// regression: feedback-command-eager-expansion
test('slash commands wait for acceptance and Escape dismisses suggestions without closing feedback', async () => {
  await using session = await feedbackReportingSystem.run({ seed: 424242 });
  await session.apply(feedbackAction, { type: 'open' });
  await session.apply(editorAction, { type: 'write', text: '/bugix' });
  expect((await session.read(readFeedbackView)).draft?.body).toBe('/bugix');
  expect((await session.read(readEditorView)).suggestions.join(' ')).toContain(
    '/bug'
  );
  await session.apply(editorAction, { type: 'key', text: 'Escape' });
  expect((await session.read(readEditorView)).suggestions).toEqual([]);
  expect((await session.read(readFeedbackView)).wizardCount).toBe(1);
  await session.apply(editorAction, { type: 'write', text: '/' });
  await session.apply(editorAction, { type: 'key', text: 'ArrowDown' });
  await session.apply(editorAction, { type: 'key', text: 'Enter' });
  const draft = (await session.read(readFeedbackView)).draft;
  expect(draft?.kind).toBe('feature');
  expect(draft?.body).toContain('## The opportunity');
  await session.apply(wizardAction, { type: 'phone' });
  await session.apply(feedbackAction, { type: 'open' });
  await session.apply(editorAction, { type: 'write', text: '/pol' });
  expect((await session.read(readEditorView)).suggestions.join(' ')).toContain(
    '/polish'
  );
  await session.apply(editorAction, { type: 'key', text: 'Escape' });
  expect((await session.read(readEditorView)).suggestions).toEqual([]);
  expect((await session.read(readFeedbackView)).wizardCount).toBe(1);
});
