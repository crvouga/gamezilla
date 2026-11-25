import { expect, test } from 'bun:test';
import { createRoot, createSignal, flush } from 'solid-js';
import { heartsTableStory } from '../src/hearts-table.example';

// regression: hearts-story-table-refusal-frozen
test('a refused pass that appears after the Hearts story opens still reaches the frame', () => {
  const [error, setError] = createSignal('');
  const { shown, dispose } = createRoot((dispose) => ({
    shown: heartsTableStory(
      {
        get error() {
          return error();
        },
      },
      () => 'hearts:1:pass:0,0,0,0:-::-'
    ),
    dispose,
  }));
  expect(shown.error).toBe('');
  setError('The choice could not be confirmed. Try again.');
  flush();
  expect(shown.error).toBe('The choice could not be confirmed. Try again.');
  expect(shown.seatedMoves).toBe(false);
  dispose();
});
