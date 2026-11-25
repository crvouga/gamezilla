/** @jsxImportSource @solidjs/web */
import { expect, test } from 'bun:test';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';
import { flush } from 'solid-js';
import { renderBoard } from './render';

function passing() {
  const view = renderBoard(() => (
    <HeartsBoard
      position={heartsRules.initial()}
      orientation="white"
      interactive
      sound={false}
      syncKey={0}
      setup={null}
      hand="2C3C"
      committed={[]}
      commitment={null}
      testId="gesture"
      onAction={() => {
        throw new Error('Inspecting or choosing a card must not send the pass');
      }}
    />
  ));
  flush();
  const felt = view.container.querySelector<HTMLElement>(
    '[data-hearts-viewport]'
  );
  const card =
    view.container.querySelector<HTMLButtonElement>('button[data-card]');
  if (!felt || !card) throw new Error('Missing playable hand or table');
  felt.getBoundingClientRect = () => new DOMRect(10, 20, 390, 250);
  card.setPointerCapture = () => undefined;
  return { felt, card, view };
}

function contact(
  target: HTMLElement,
  type: string,
  [x, y]: [number, number],
  id = 1
) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: x,
      clientY: y,
      pointerId: id,
      isPrimary: id === 1,
    })
  );
  flush();
}

test('a second finger cancels the pickup until release; a fresh drop selects exactly once', () => {
  const { card, felt } = passing();
  contact(card, 'pointerdown', [30, 400]);
  contact(card, 'pointermove', [40, 220]);
  contact(felt, 'pointerdown', [100, 140], 2);
  contact(felt, 'pointerup', [40, 220]);
  contact(felt, 'pointerup', [100, 140], 2);
  expect(card.getAttribute('aria-pressed')).toBe('false');
  contact(card, 'pointerdown', [30, 400]);
  contact(card, 'pointermove', [40, 220]);
  contact(card, 'pointerup', [40, 220]);
  card.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })
  );
  flush();
  expect(card.getAttribute('aria-pressed')).toBe('true');
});

test('pinching an off-centre point keeps that point still and offers a return to fit', () => {
  const { felt, view } = passing();
  contact(felt, 'pointerdown', [88, 70]);
  contact(felt, 'pointerdown', [128, 70], 2);
  contact(felt, 'pointermove', [68, 70]);
  contact(felt, 'pointermove', [148, 70], 2);
  contact(felt, 'pointerup', [68, 70]);
  contact(felt, 'pointerup', [148, 70], 2);
  expect(felt.style.getPropertyValue('--hearts-scale')).toBe('2');
  expect(
    Number.parseFloat(felt.style.getPropertyValue('--hearts-pan-x'))
  ).toBeCloseTo((-100 * 98) / 390);
  expect(
    Number.parseFloat(felt.style.getPropertyValue('--hearts-pan-y'))
  ).toBeCloseTo(-20);
  view.getByRole('button', { name: 'Fit table' }).click();
  flush();
  expect(felt.style.getPropertyValue('--hearts-scale')).toBe('1');
  expect(felt.style.getPropertyValue('--hearts-pan-x')).toBe('0%');
});

// regression: hearts-focus-transfer-cancels-tap
test('tab focus moving from the first card to the second does not cancel the next tap', () => {
  const { card, view } = passing();
  const next = view.getByTestId('gesture-card-3C');
  card.focus();
  contact(next, 'pointerdown', [80, 400]);
  next.focus();
  contact(next, 'pointerup', [80, 400]);
  next.dispatchEvent(
    new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })
  );
  flush();
  expect(next.getAttribute('aria-pressed')).toBe('true');
});
