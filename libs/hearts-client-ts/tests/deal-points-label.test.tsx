/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import { byTestId, renderBoard } from './render';

// regression: hearts-taken-score-unit-ambiguous
test('the queen-bearing trick labels thirteen as deal points beside the cumulative score', () => {
  renderBoard(() => (
    <HeartsBoard
      position="hearts:4:play:10,20,30,40:0:2C3C4C5CQSKSAS2S:-"
      orientation="white"
      interactive={false}
      sound={false}
      syncKey={0}
      setup={null}
      hand={null}
      committed={[]}
      commitment={null}
      testId="hearts"
      onAction={() => {
        throw new Error('Reading a score must not play');
      }}
    />
  ));
  const west = byTestId('hearts-seat-black');
  expect(west.textContent).toContain('Score 20');
  expect(west.textContent).toContain('Deal points 13');
  expect(west.textContent).not.toContain('Taken 13');
});
