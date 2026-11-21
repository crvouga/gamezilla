/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { cleanup, screen } from '@solidjs/testing-library';
import { mountPlay } from './puzzle-play-view-fixture';

afterEach(cleanup);

// regression: puzzle-solution-label-hides-consequence
test('the move hint and the attempt-ending solution have distinct labels', () => {
  mountPlay('play', { hintStage: 'highlight' });
  expect(screen.getByRole('button', { name: 'Reveal move' })).toBeTruthy();
  cleanup();
  mountPlay('play', { statusKind: 'failed', status: 'wrong' });
  expect(
    screen.getByRole('button', { name: 'Reveal and end attempt' })
  ).toBeTruthy();
});
