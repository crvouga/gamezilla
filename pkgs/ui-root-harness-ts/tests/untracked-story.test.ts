import { expect, test } from 'bun:test';
import { createMemo, createRoot, createSignal, flush } from 'solid-js';
import { untrackedStory } from '../storybook/untracked-story';

// regression: storybook-global-change-blanks-story
test('a global read while a story renders does not re-run the mounted story', () => {
  const [background, setBackground] = createSignal('canvas');
  const { shown, dispose } = createRoot((dispose) => {
    const shown = createMemo(() => untrackedStory(background)(null));
    return { shown, dispose };
  });
  expect(shown()).toBe('canvas');
  setBackground('surface');
  flush();
  expect(shown()).toBe('canvas');
  dispose();
});
