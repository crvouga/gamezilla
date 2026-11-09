import { afterEach, expect, test } from 'bun:test';
import { CardTable } from '@pkgs/ui-root-client-ts/card-table';
import { cleanup, fireEvent } from '@solidjs/testing-library';
import { renderUi } from './render';

afterEach(cleanup);

// regression: hearts-unavailable-card-color-only
test('a refused nine of diamonds explains follow suit before activation and never plays', () => {
  const played: string[] = [];
  const reason = 'You must follow suit with a spade.';
  const view = renderUi(() => (
    <CardTable
      label="Hearts"
      testId="availability"
      seats={[]}
      center="Your turn"
      handLabel="Your hand"
      hand={[
        {
          id: '9D',
          rank: '9',
          suit: 'diamonds',
          suitName: 'diamonds',
          label: 'Nine of diamonds',
          selected: null,
          enabled: false,
          refusal: reason,
        },
      ]}
      cardTestId={(id) => id}
      onCard={(id) => played.push(id)}
    />
  ));
  expect(view.getByText(reason, { selector: 'span' })).toBeTruthy();
  const card = view.getByTestId('9D');
  expect(card.title).toBe(reason);
  expect(card.textContent).toContain('×');
  fireEvent.click(card);
  expect(played).toEqual([]);
  expect(view.getByTestId('availability-refusal').textContent).toBe(reason);
});
