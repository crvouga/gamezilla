import { expect, test } from 'bun:test';
import { WordTilesBlankChooser } from '@libs/word-tiles-client-ts/word-tiles-panels';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { fireEvent } from '@solidjs/testing-library';

// regression: word-tiles-blank-small-targets
test('all 26 blank letters use full medium controls and native keyboard-focusable buttons', () => {
  const chosen: string[] = [];
  const view = render(() => (
    <WordTilesBlankChooser
      testId="blank"
      onChoose={(letter) => chosen.push(letter)}
    />
  ));
  const buttons = view.getAllByRole('button');
  expect(buttons).toHaveLength(26);
  expect(
    view
      .getByRole('group', { name: 'Choose the letter your blank plays' })
      .getAttribute('data-component')
  ).toBe('WordTileLetterChoices');
  expect(document.activeElement).toBe(view.getByRole('button', { name: 'A' }));
  for (const [index, button] of buttons.entries()) {
    expect(button.getAttribute('data-size')).toBe('md');
    expect(button.textContent).toBe(String.fromCharCode(65 + index));
    button.focus();
    expect(document.activeElement).toBe(button);
  }
  fireEvent.click(view.getByRole('button', { name: 'S' }));
  expect(chosen).toEqual(['S']);
});
