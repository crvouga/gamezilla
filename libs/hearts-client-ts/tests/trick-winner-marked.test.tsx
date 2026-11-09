/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import { byTestId, renderBoard } from './render';

// regression: hearts-trick-winner-unmarked
test("West's ten of clubs takes the first trick, and the table marks it in words until the next card", () => {
  renderBoard(() => (
    <HeartsBoard
      position="hearts:4:play:10,20,30,40:0:2CTC4C9C:0,0,26,0"
      orientation="white"
      interactive={false}
      sound={false}
      syncKey={0}
      setup={null}
      hand="3C4DQS2H3H4H5H6H7H8H9HTH"
      committed={[]}
      commitment={null}
      testId="hearts"
      onAction={() => undefined}
    />
  ));
  const won = byTestId('hearts-seat-black-played');
  expect(won.getAttribute('aria-label')).toEndWith(', Took it');
  expect(won.parentElement?.getAttribute('data-won')).toBe('true');
  expect(won.parentElement?.textContent).toContain('Took it');
  for (const side of ['white', 'red', 'blue'])
    expect(
      byTestId(`hearts-seat-${side}-played`).parentElement?.getAttribute(
        'data-won'
      )
    ).toBe('false');
});
