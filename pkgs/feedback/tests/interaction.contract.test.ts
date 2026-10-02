import { expect, test } from 'bun:test';
import { feedbackInteraction } from '@pkgs/feedback/client';
import { assertProperty, fc } from '@pkgs/property';

test('sensitive inputs and support controls never enter the reproduction trail', async () => {
  await assertProperty(
    'feedback-privacy',
    fc.property(
      fc.constantFrom('password', 'email', 'tel', 'hidden'),
      fc.string(),
      (type, secret) => {
        const input = document.createElement('input');
        input.type = type;
        input.value = secret;
        const event = new Event('input');
        input.dispatchEvent(event);
        expect(feedbackInteraction(event, '/chess')).toBeNull();
      }
    )
  );
  const host = document.createElement('div');
  host.dataset['feedbackPrivate'] = '';
  const button = document.createElement('button');
  button.textContent = 'Private action';
  host.append(button);
  const event = new Event('click');
  button.dispatchEvent(event);
  expect(feedbackInteraction(event, '/chess')).toBeNull();
});

// regression: feedback-board-drag-missing
test('board-level pointer capture keeps both endpoints of a chess drag', () => {
  const board = document.createElement('div');
  board.dataset['testid'] = 'chess-puzzle-board';
  board.setAttribute('aria-label', 'Chessboard');
  board.getBoundingClientRect = () => new DOMRect(10, 20, 400, 400);
  for (const [type, x, y] of [
    ['pointerdown', 235, 345],
    ['pointerup', 235, 245],
  ] as const) {
    const event = new PointerEvent(type, { clientX: x, clientY: y });
    board.dispatchEvent(event);
    expect(feedbackInteraction(event, '/chess')).toMatchObject({
      type,
      target: '[data-testid="chess-puzzle-board"]',
      point: { x: 0.5625, y: (y - 20) / 400 },
    });
  }
});

test('recorded keyboard navigation excludes typed characters', () => {
  const button = document.createElement('button');
  button.dataset['testid'] = 'move-history';
  const navigation = new KeyboardEvent('keydown', { key: 'ArrowLeft' });
  button.dispatchEvent(navigation);
  expect(feedbackInteraction(navigation, '/chess')?.value).toBe('ArrowLeft');
  const character = new KeyboardEvent('keydown', { key: 'A' });
  button.dispatchEvent(character);
  expect(feedbackInteraction(character, '/chess')).toBeNull();
});
