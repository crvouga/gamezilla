import { expect, test } from 'bun:test';
import { passThreeHeartsCards } from '@libs/runtime-harness-ts/hearts-trick-journey';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { journeyDiagnosticDriver } from './journey-diagnostic-driver';

const HAND = '4C JC AC 2D 6D TD QD 6S JS QS 6H 9H AH'.split(' ');
const PREFIX = 'game-session-board-card-';
const PASS = 'game-session-board-pass';

/** A dealt hand becomes interactive when the pending room command settles. */
function passingHand(ignoredCard?: string) {
  const base = journeyDiagnosticDriver({
    html: null,
    visible: HAND.map((card) => PREFIX + card),
    texts: {},
    captions: {},
  }).ui;
  const chosen = new Set<string>();
  const taps: string[] = [];
  let interactive = false;
  let passed = false;
  const ui: Driver = {
    ...base,
    get(id) {
      const node = base.get(id);
      const card = id.slice(PREFIX.length);
      return {
        ...node,
        attribute: async (name) =>
          name === 'aria-pressed' ? String(chosen.has(card)) : null,
        wait: async (state) => {
          expect(state).toBe('enabled');
          if (id === PASS) expect(chosen.size).toBe(3);
          else if (HAND.includes(card)) interactive = true;
          else throw new Error('No such card');
        },
        tap: async () => {
          taps.push(id);
          if (id === PASS) {
            if (chosen.size !== 3) throw new Error('Pass is disabled');
            passed = true;
          } else if (interactive && card !== ignoredCard) {
            if (chosen.has(card)) chosen.delete(card);
            else chosen.add(card);
          }
        },
        expect: {
          ...node.expect,
          hidden: async () => {
            expect(id).toBe(PASS);
            expect(passed).toBe(true);
          },
        },
      };
    },
  };
  return { ui, chosen, taps };
}

// regression: hearts-first-trick-pass-before-selection
test('the first trick passes the first three cards once the dealt hand takes input', async () => {
  const hand = passingHand();
  await passThreeHeartsCards(hand.ui);
  expect([...hand.chosen]).toEqual(['4C', 'JC', 'AC']);
  expect(hand.taps).toEqual([
    PREFIX + '4C',
    PREFIX + 'JC',
    PREFIX + 'AC',
    PASS,
  ]);
});

test('a delivered tap that leaves the jack unselected identifies that card before Pass', async () => {
  const hand = passingHand('JC');
  await expect(passThreeHeartsCards(hand.ui)).rejects.toThrow('JC');
  expect(hand.taps).toEqual([PREFIX + '4C', PREFIX + 'JC']);
});
