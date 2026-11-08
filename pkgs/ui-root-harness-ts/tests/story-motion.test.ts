import { expect, test } from 'bun:test';
import { storyReducedMotion } from '../storybook/story-motion';

// regression: storybook-preview-forces-reduced-motion
test('stories reduce motion unless a capture asks for the system setting', () => {
  expect(storyReducedMotion({})).toBe(true);
  expect(storyReducedMotion({ motion: 'reduced' })).toBe(true);
  expect(storyReducedMotion({ motion: 'system' })).toBe(false);
});
