/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import { renderBoard } from './render';

// regression: hearts-passed-waiting-copy-visually-hidden
test('an acknowledged three-club pass explains the waiting hand beside its cards', () => {
  const view = renderBoard(() => (
    <HeartsBoard
      position="hearts:1:pass:0,0,0,0:-::-"
      orientation="white"
      interactive={false}
      sound={false}
      syncKey={1}
      setup={null}
      hand="2C3C4C5C6C7C8C9CTCJCQCKCAC"
      committed={['white']}
      commitment="2C3C4C"
      testId="hearts"
      onAction={() => undefined}
    />
  ));
  const guidance = view.getByText(
    'Your cards are chosen. Waiting for every player to pass.',
    { exact: true }
  );
  expect(guidance.getAttribute('data-spoken-only')).not.toBe('true');
  expect(guidance.textContent).toContain('Waiting for every player');
});
