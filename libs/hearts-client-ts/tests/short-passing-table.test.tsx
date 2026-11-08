/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import { byTestId, renderBoard } from './render';

// regression: hearts-short-passing-context-crowds-hand
test('320x568 passing keeps players and scores discoverable and restores the table for play', () => {
  const [position, setPosition] = createSignal('hearts:1:pass:0,0,0,0:-::-');
  const view = renderBoard(
    () => (
      <HeartsBoard
        position={position()}
        orientation="white"
        interactive
        sound={false}
        syncKey={0}
        setup={null}
        hand="2C3C4C5C6C7C8C9CTCJCQCKCAC"
        committed={[]}
        commitment={null}
        testId="hearts"
        onAction={() => undefined}
      />
    ),
    { width: 320, height: 568 }
  );
  const toggle = view.getByRole('button', { name: 'Players and scores' });
  expect(toggle.getAttribute('aria-expanded')).toBe('false');
  fireEvent.click(byTestId('hearts-card-2C'));
  fireEvent.click(toggle);
  expect(toggle.getAttribute('aria-expanded')).toBe('true');
  expect(byTestId('hearts-seat-white').textContent).toContain('South');
  expect(byTestId('hearts-seat-white').textContent).toContain('Score 0');
  fireEvent.click(toggle);
  expect(byTestId('hearts-card-2C').getAttribute('aria-pressed')).toBe('true');
  setPosition('hearts:4:play:10,20,30,40:0::-');
  expect(view.queryByRole('button', { name: 'Players and scores' })).toBeNull();
  expect(byTestId('hearts-seat-black').textContent).toContain('Score 20');
});
