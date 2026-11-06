import { expect, test } from 'bun:test';
import {
  newCandidate,
  pressTile,
  rebase,
  toggleExchange,
} from '@libs/word-tiles-client-ts/word-tiles-candidate';
import {
  encodePosition,
  newPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';

test('accepted exchange settles selection; refusal keeps the chosen tiles', () => {
  // regression: word-tiles-exchange-mode-after-acceptance
  const position = newPosition(2, 'enable1.90ef7a729517');
  const before = encodePosition(position);
  const hand = '11,0,82,98,25,77,69';
  const selected = pressTile(toggleExchange(newCandidate(before, hand)), 11);
  expect(rebase(selected, before, hand).exchange).toEqual([11]);
  const next = encodePosition({ ...position, turn: 1, scoreless: 1 });
  const recordFirst = rebase(selected, next, hand);
  expect(recordFirst.exchange).toEqual([11]);
  const rackFirst = rebase(selected, before, '1,0,82,98,25,77,69');
  expect(rackFirst.exchange).toEqual([11]);
  expect(rebase(rackFirst, next, '1,0,82,98,25,77,69').exchange).toBeNull();
  expect(rebase(recordFirst, next, '1,0,82,98,25,77,69').exchange).toBeNull();
  expect(
    rebase(
      selected,
      encodePosition({ ...position, turn: 1, scoreless: 1 }),
      '1,0,82,98,25,77,69'
    ).exchange
  ).toBeNull();
});
