import { afterEach, expect, test } from 'bun:test';
import { CardTable } from '@pkgs/ui-root-client-ts/card-table';
import { cleanup, fireEvent } from '@solidjs/testing-library';
import { renderUi } from './render';

afterEach(cleanup);

// regression: hearts-refusal-reason-shown-twice
test('pressing a refused nine of diamonds shows its follow-suit reason once and still announces it', () => {
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
      onCard={() => undefined}
    />
  ));
  fireEvent.click(view.getByTestId('9D'));
  const status = view.getByTestId('availability-refusal');
  expect(status.textContent).toBe(reason);
  expect(status.getAttribute('role')).toBe('status');
  expect(status.getAttribute('data-spoken-only')).toBe('true');
  const visible = view.getByText(reason, { selector: 'span' });
  expect(visible.parentElement?.getAttribute('data-emphasis')).toBe('true');
});
