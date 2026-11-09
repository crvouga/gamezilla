/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import { HeartsBoard } from '@libs/hearts-client-ts/hearts-board';
import { byTestId, renderBoard } from './render';

// regression: hearts-refusal-not-described-on-focus
test('the refused four of diamonds describes why it cannot follow the two of clubs', () => {
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
      onAction={() => {
        throw new Error('Focus must not play');
      }}
    />
  ));
  const refused = byTestId('hearts-card-4D');
  refused.focus();
  const id = refused.getAttribute('aria-describedby');
  expect(id).toBeTruthy();
  expect(
    view.container.ownerDocument.getElementById(id ?? '')?.textContent
  ).toBe('You must follow suit with a card of the suit led.');
  expect(byTestId('hearts-card-3C').hasAttribute('aria-describedby')).toBe(
    false
  );
});
