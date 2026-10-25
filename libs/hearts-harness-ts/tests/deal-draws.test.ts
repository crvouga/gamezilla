import { expect, test } from 'bun:test';
import { heartsHandAfter } from '@libs/hearts-harness-ts/hearts-lines';

const suit = (letter: string) =>
  [...'23456789TJQKA'].map((rank) => `${rank}${letter}`).join('');

test('the documented draws deal exactly the hands a scenario names', () => {
  const hands = {
    white: suit('C'),
    black: suit('D'),
    red: suit('S'),
    blue: suit('H'),
  };
  for (const side of ['white', 'black', 'red', 'blue'] as const)
    expect(heartsHandAfter({ hands, history: [] }, side)).toBe(hands[side]);
});
