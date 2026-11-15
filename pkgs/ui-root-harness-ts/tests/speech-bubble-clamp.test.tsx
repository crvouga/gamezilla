/** @jsxImportSource solid-js */
import { afterEach, expect, test } from 'bun:test';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { SpeechBubble } from '@pkgs/ui-root-client-ts/speech-bubble';
import { cleanup, screen } from '@solidjs/testing-library';

afterEach(cleanup);

const WORDS =
  'The bishop on g4 pins your knight to the queen, but pins can be broken when the reward is bigger than what you give up.';

test('a clamped bubble shows at most its lines, and keeps every word for listeners', () => {
  renderWithI18n(() => <SpeechBubble text={WORDS} clampLines={3} />);
  const words = screen.getByRole('status');
  expect(words.textContent).toBe(WORDS);
  // Clamped: the line-clamp class, reading its line count.
  expect(words.style.getPropertyValue('--bubble-lines')).toBe('3');
});

test('a bubble without a clamp shows every line', () => {
  renderWithI18n(() => <SpeechBubble text={WORDS} />);
  expect(
    screen.getByRole('status').style.getPropertyValue('--bubble-lines')
  ).toBe('');
  expect(
    document.querySelector('[data-component="SpeechBubbleMore"]')
  ).toBeNull();
});
