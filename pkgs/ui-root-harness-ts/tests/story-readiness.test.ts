import { expect, test } from 'bun:test';
import { Channel } from 'storybook/internal/channels';
import {
  STORY_FINISHED,
  STORY_RENDER_PHASE_CHANGED,
} from 'storybook/internal/core-events';
import { trackStoryReadiness } from '../storybook/story-readiness';

// regression: storybook-ready-before-play-completion
test('args rerenders cannot mark a still-playing story ready', () => {
  const channel = new Channel({});
  const canvas = document.createElement('div');
  const cleanup = trackStoryReadiness(canvas, 'input--submit', channel);
  channel.emit(STORY_RENDER_PHASE_CHANGED, {
    storyId: 'input--submit',
    newPhase: 'playing',
  });
  channel.emit(STORY_RENDER_PHASE_CHANGED, {
    storyId: 'input--submit',
    newPhase: 'loading',
  });
  channel.emit(STORY_FINISHED, {
    storyId: 'input--submit',
    status: 'success',
    reporters: [],
  });
  expect(canvas.hasAttribute('data-story-ready')).toBe(false);
  channel.emit(STORY_RENDER_PHASE_CHANGED, {
    storyId: 'input--submit',
    newPhase: 'played',
  });
  channel.emit(STORY_FINISHED, {
    storyId: 'input--submit',
    status: 'success',
    reporters: [],
  });
  expect(canvas.getAttribute('data-story-status')).toBe('success');
  expect(canvas.getAttribute('data-story-ready')).toBe('true');
  cleanup();
});

test('native story failures remain failures after a successful args rerender', () => {
  const channel = new Channel({});
  const canvas = document.createElement('div');
  const cleanup = trackStoryReadiness(canvas, 'input--submit', channel);
  channel.emit(STORY_RENDER_PHASE_CHANGED, {
    storyId: 'input--submit',
    newPhase: 'errored',
  });
  channel.emit(STORY_FINISHED, {
    storyId: 'input--submit',
    status: 'error',
    reporters: [],
  });
  channel.emit(STORY_FINISHED, {
    storyId: 'input--submit',
    status: 'success',
    reporters: [],
  });
  expect(canvas.getAttribute('data-story-status')).toBe('error');
  expect(canvas.hasAttribute('data-story-ready')).toBe(false);
  cleanup();
});

test('readiness ignores other stories and detaches native listeners on cleanup', () => {
  const channel = new Channel({});
  const canvas = document.createElement('div');
  const cleanup = trackStoryReadiness(canvas, 'input--submit', channel);
  channel.emit(STORY_FINISHED, {
    storyId: 'other--story',
    status: 'success',
    reporters: [],
  });
  expect(canvas.hasAttribute('data-story-ready')).toBe(false);
  cleanup();
  channel.emit(STORY_FINISHED, {
    storyId: 'input--submit',
    status: 'success',
    reporters: [],
  });
  expect(canvas.hasAttribute('data-story-ready')).toBe(false);
});

// regression: storybook-ready-before-play-completion
test('a nested render cannot finish the story before the original completion hooks', () => {
  const channel = new Channel({});
  const canvas = document.createElement('div');
  const cleanup = trackStoryReadiness(canvas, 'input--submit', channel);
  channel.emit(STORY_RENDER_PHASE_CHANGED, {
    storyId: 'input--submit',
    newPhase: 'playing',
  });
  channel.emit(STORY_RENDER_PHASE_CHANGED, {
    storyId: 'input--submit',
    newPhase: 'loading',
  });
  channel.emit(STORY_RENDER_PHASE_CHANGED, {
    storyId: 'input--submit',
    newPhase: 'played',
  });
  channel.emit(STORY_FINISHED, {
    storyId: 'input--submit',
    status: 'success',
    reporters: [],
  });
  expect(canvas.hasAttribute('data-story-ready')).toBe(false);
  channel.emit(STORY_FINISHED, {
    storyId: 'input--submit',
    status: 'error',
    reporters: [],
  });
  expect(canvas.getAttribute('data-story-status')).toBe('error');
  expect(canvas.hasAttribute('data-story-ready')).toBe(false);
  cleanup();
});
