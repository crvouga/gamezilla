/** @jsxImportSource solid-js */
import { expect, test } from 'bun:test';
import {
  encodeHearts,
  INITIAL_HEARTS,
} from '@libs/hearts-shared-ts/hearts-position';
import {
  passActionTo,
  passHeadingTo,
  passInstructionTo,
} from '../src/hearts-copy';
import { passRecipient } from '../src/hearts-table-view';

// regression: hearts-pass-recipient-unnamed
test('South passing left in the first deal is told the cards go to jordan_plays, West', () => {
  const names: Record<string, string> = { black: 'jordan_plays' };
  const recipient = passRecipient(
    encodeHearts(INITIAL_HEARTS),
    'white',
    (side) => names[side] ?? null
  );
  expect(recipient).toBe('jordan_plays');
  expect(passActionTo('left', recipient)).toBe('Pass to jordan_plays');
  expect(passHeadingTo('left', false, recipient)).toBe(
    'Passing to jordan_plays, on your left'
  );
  expect(passInstructionTo('left', recipient)).toBe(
    'Pass three cards to the left, to jordan_plays.'
  );
  // A watcher passes nothing, so nobody is named.
  expect(passRecipient(encodeHearts(INITIAL_HEARTS), null, () => null)).toBe(
    null
  );
});
