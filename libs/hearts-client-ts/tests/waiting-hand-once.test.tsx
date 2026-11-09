/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import { fireEvent } from '@solidjs/testing-library';
import { byTestId, renderBoard } from './render';

// regression: hearts-waiting-hand-marked-refused
test('while West plays, South holds the 3C and the hand waits as one, said once, not card by card', () => {
  const view = renderBoard(() => (
    <HeartsBoard
      position="hearts:4:play:10,20,30,40:0:2C:0,0,26,0"
      orientation="white"
      interactive={false}
      sound={false}
      syncKey={0}
      setup={null}
      hand="3C4DQS2H3H4H5H6H7H8H9HTHJH"
      committed={[]}
      commitment={null}
      testId="hearts"
      onAction={() => {
        throw new Error('A waiting hand must not play');
      }}
    />
  ));
  expect(byTestId('hearts-hand').getAttribute('data-waiting')).toBe('true');
  for (const card of ['3C', '4D', 'QS', '2H'])
    expect(byTestId(`hearts-card-${card}`).getAttribute('data-refused')).toBe(
      'false'
    );
  const waiting = view.getByText('Not your turn. West plays next.');
  expect(byTestId('hearts-card-3C').getAttribute('aria-describedby')).toBe(
    waiting.id
  );
  fireEvent.click(byTestId('hearts-card-3C'));
  expect(byTestId('hearts-refusal').textContent).toBe(
    'Not your turn. West plays next.'
  );
});

// regression: hearts-refusal-repeated-per-card
test('every card West cannot follow suit with points to one shared rule, not its own copy', () => {
  const view = renderBoard(() => (
    <HeartsBoard
      position="hearts:4:play:10,20,30,40:0:2C:0,0,26,0"
      orientation="black"
      interactive
      sound={false}
      syncKey={0}
      setup={null}
      hand="3C4DQS2H3H4H5H6H7H8H9HTHJH"
      committed={[]}
      commitment={null}
      testId="hearts"
      onAction={() => undefined}
    />
  ));
  const rule = 'You must follow suit with a card of the suit led.';
  const ids = new Set(
    ['4D', 'QS', '2H', 'JH'].map((card) =>
      byTestId(`hearts-card-${card}`).getAttribute('aria-describedby')
    )
  );
  expect(ids.size).toBe(1);
  expect(view.getAllByText(rule)).toHaveLength(1);
});
