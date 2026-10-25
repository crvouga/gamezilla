import { expect, test } from 'bun:test';
import {
  decodeHearts,
  encodeHearts,
  INITIAL_HEARTS,
} from '@libs/hearts-shared-ts/hearts-position';
import { heartsRules } from '@libs/hearts-shared-ts/hearts-rules';

// regression: hearts-unreachable-position
test('a position play cannot reach is not a Hearts position', () => {
  for (const unreachable of [
    // The fourth deal holds its cards: nobody passes.
    'hearts:4:pass:10,20,30,40:-::0,0,26,0',
    'hearts:8:pass:10,20,30,40:-::0,0,26,0',
    // A finished match has a score at 100; one under way has none.
    'hearts:1:done:0,0,0,0:-::-',
    'hearts:2:pass:150,0,0,0:-::26,0,0,0',
    'hearts:6:play:100,0,0,0:0::26,0,0,0',
  ]) {
    expect(decodeHearts(unreachable)).toBeNull();
    expect(heartsRules.recognizes(unreachable)).toBe(false);
  }
});

test('positions play reaches still read back as written', () => {
  for (const reachable of [
    encodeHearts(INITIAL_HEARTS),
    'hearts:4:play:10,20,30,40:2::0,0,26,0',
    'hearts:5:pass:10,20,30,40:-::0,0,26,0',
    'hearts:9:done:100,20,30,40:-::26,0,0,0',
  ]) {
    const position = decodeHearts(reachable);
    expect(position).not.toBeNull();
    expect(encodeHearts(position!)).toBe(reachable);
  }
});
