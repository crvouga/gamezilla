/**
 * A known Hearts game of five whole deals from the passing deal, after which
 * the cumulative scores stand at South 12, West 90, North 14 and East 14
 * (each deal South 2 or 3, West 18 — the queen of spades and five hearts —
 * North and East 2 or 3). Found once by searching each deal's passes and
 * plays for those penalty points, frozen here, and replayed through the
 * rules in this package's tests. Each line is a pass (every seat's three
 * cards in seat order) or one trick's four cards.
 */

import type { HeartsLine } from './hearts-lines';
import { PASSING_DEAL } from './hearts-tables';

const FIVE_DEALS: readonly string[] = [
  'commit:2C2H5C|AH9D2S|8S7S4H|QD4S2D',
  '2C AC 3C 7C',
  '9S 5S AS 3S',
  '4S 2H TS 7S',
  '5H 4H 3H JH',
  'QH AH QC 2D',
  '2S 6S KS TH',
  '6C JC KC 4C',
  '9D AD QD 8D',
  'JD 7D TD 6H',
  'KD 6D KH 7H',
  '3D 5D 5C 8H',
  '8C TC 9H 4D',
  '9C JS 8S QS',
  'commit:JD7H9C|ASJC6H|AH8S5D|2D6D3C',
  '2C 7C QC JC',
  '4S 9S QS TS',
  '8C 5C 6C 2H',
  'AH 4H 8H 6H',
  'JS KS 6S 3S',
  'TH 7H 3H 8S',
  '3C 9C KH 4C',
  'JD KD 5D 8D',
  'AS 7S 9H 2S',
  '5H 7D 6D JH',
  'AD 9D QD TD',
  '3D 4D KC 2D',
  'QH AC TC 5S',
  'commit:7D4S6H|4CASKC|JC3C9C|AD8SJH',
  '2C 8S TC 4C',
  '7D JD 5D 3D',
  'TS 7S QS 4S',
  'JS 3S 6S 7H',
  'JH 6H 3H 9H',
  '2S 5S AS TH',
  'KS 9C AH KH',
  'TD 4D 6D KD',
  'QH 8D 6C 8H',
  'QC KC AC 4H',
  '3C AD 8C 2D',
  '5C 9D 7C 5H',
  'JC 2H QD 9S',
  '2C TC JC 6C',
  'AC 4C 9C 8C',
  '7S 4S 3S AS',
  '6D QD TD 8D',
  '2D 3D 9D AD',
  '5D 7D JD 6H',
  '9H 7H 2H 5H',
  '5S 8S 2S KS',
  '4D 8H TH KD',
  '7C QS KC QC',
  'QH 5C KH AH',
  'TS 3H JS 6S',
  '3C 9S JH 4H',
  'commit:7SJH5S|4C4H9C|KDAC3C|KCJD3H',
  '2C 5C AC 7C',
  'KD AD 5D 6D',
  '8D 2H 4D 2D',
  '7H JH 4H 6H',
  'QS 3S 9S 2S',
  '6C JC QC KC',
  'AS KS AH 8S',
  'JD 6S TD 9D',
  '3D 4S 7D TH',
  'QD 9H TC 5H',
  '4C 3C QH 8C',
  '5S 9C TS 3H',
  'JS 8H 7S KH',
];

/** The game once five deals are scored: the sixth deal awaits its passes. */
export function fiveDealsScored(): HeartsLine {
  return {
    hands: PASSING_DEAL,
    seed: [0.31, 0.62, 0.17, 0.89],
    history: FIVE_DEALS.flatMap((line) =>
      line.startsWith('commit:') ? [line] : line.split(' ')
    ),
  };
}
