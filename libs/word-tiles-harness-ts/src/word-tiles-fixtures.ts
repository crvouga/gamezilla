import type { GameFixtures } from '@libs/game-session-harness-ts/harness-game';

/**
 * Known lines, written and checked by hand from the rules (scores worked out
 * square by square, rack values tile by tile). Each starts from a known
 * deal: the four numbers the authority's random source returns as the game
 * starts (a 128-bit seed), which deal the hidden state beside them.
 *
 * Two and three seats: Amber plays WONTS on f8–j8 (W4 × 3 on f8 + O1 + N1 +
 * T1 + S1 × 3 on j8 = 18, doubled on h8 = 36); then six passes in a row end
 * the game, every rack counting against its holder. Amber keeps S E T L M L
 * I (9) — at three seats S E F O N L S (10) — against Teal's blank R I I E E
 * U (6) and, at three seats, Violet's T L M L I blank W (11): 27 to −6, and
 * 26 to −6 and −11.
 */
const DRAWS = [1 / 401, 0.25, 0.5, 0.75];

const PASSES = ['pass', 'pass', 'pass', 'pass', 'pass', 'pass'] as const;
const WONTS = 'play:f8=92.g8=64.h8=53.i8=83.j8=76';

export const WORD_TILES_2_FIXTURES: GameFixtures = {
  knownDeal: {
    draws: DRAWS,
    hidden:
      '{"v":1,"bag":[81,47,52,49,37,98,93,30,61,54,50,78,58,90,32,22,75,5,68,74,11,80,14,4,88,13,16,59,2,38,97,21,19,56,28,33,45,34,46,66,41,94,44,57,23,3,12,8,39,86,70,87,42,6,27,7,1,26,31,84,60,95,96,71,67,51,91,69,63,62,72,17,85,29,65,10,79,55,82,15,48,9,20,35,36,0],"racks":[[53,83,77,18,76,64,92],[99,73,40,43,25,24,89]],"board":[],"rng":[191027619,305892523,1828946202,4271414614]}',
    hands: [
      // N T S E S O W and blank R I I E E U.
      { white: '53,83,77,18,76,64,92', black: '99,73,40,43,25,24,89' },
      // W O N T S played; T L M L I drawn.
      { white: '77,18,81,47,52,49,37', black: '99,73,40,43,25,24,89' },
    ],
  },
  firstSideVictory: [WONTS, ...PASSES],
  firstSideVictoryLabels: ['WONTS f8 36', ...PASSES],
  refusedOpenings: ['', 'play:', 'swap:', 'play:a1=53.b1=83', 'play:h8=53'],
};

export const WORD_TILES_3_FIXTURES: GameFixtures = {
  knownDeal: {
    draws: DRAWS,
    hidden:
      '{"v":1,"bag":[30,61,54,50,78,58,90,32,22,75,5,68,74,11,80,14,4,88,13,16,59,2,38,97,21,19,56,28,33,45,34,46,66,41,94,44,57,23,3,12,8,39,86,70,87,42,6,27,7,1,26,31,84,60,95,96,71,67,51,91,69,63,62,72,17,85,29,65,10,79,55,82,15,48,9,20,35,36,0],"racks":[[53,83,77,18,76,64,92],[99,73,40,43,25,24,89],[81,47,52,49,37,98,93]],"board":[],"rng":[191027619,305892523,1828946202,4271414614]}',
    hands: [
      {
        white: '53,83,77,18,76,64,92',
        black: '99,73,40,43,25,24,89',
        red: '81,47,52,49,37,98,93',
      },
      // W O N T S played; F O N L S drawn.
      { white: '77,18,30,61,54,50,78' },
    ],
  },
  firstSideVictory: [WONTS, ...PASSES],
  firstSideVictoryLabels: ['WONTS f8 36', ...PASSES],
  refusedOpenings: ['', 'play:', 'swap:', 'play:a1=53.b1=83', 'play:h8=53'],
};

/**
 * Four seats: Amber plays WONTS (36, as above); Teal EURIPI on i7–n7 with
 * its blank as P (E1 × 2 on i7 + U1 + R1 × 2 on k7 + I1 + P0 + I1 on the n7
 * double word = 7, doubled = 14) with ET (E1 × 2 + T1 = 3) and US (2), 19;
 * Violet MAW on e7–g7 with its blank as A (M3 × 2 + A0 + W4 × 2 = 14) with
 * AW (4) and WO (W4 × 2 + O1 = 9), 27; then six passes end it. Racks left:
 * Amber S E G E R A P (10), Teal E R C T D A U (10), Violet T L L I D D O
 * (9), Coral F O N L S N V (13): Amber wins 26 to 9, 18 and −13.
 */
export const WORD_TILES_4_FIXTURES: GameFixtures = {
  knownDeal: {
    draws: DRAWS,
    hidden:
      '{"v":1,"bag":[32,22,75,5,68,74,11,80,14,4,88,13,16,59,2,38,97,21,19,56,28,33,45,34,46,66,41,94,44,57,23,3,12,8,39,86,70,87,42,6,27,7,1,26,31,84,60,95,96,71,67,51,91,69,63,62,72,17,85,29,65,10,79,55,82,15,48,9,20,35,36,0],"racks":[[53,83,77,18,76,64,92],[99,73,40,43,25,24,89],[81,47,52,49,37,98,93],[30,61,54,50,78,58,90]],"board":[],"rng":[191027619,305892523,1828946202,4271414614]}',
    hands: [
      {
        white: '53,83,77,18,76,64,92',
        black: '99,73,40,43,25,24,89',
        red: '81,47,52,49,37,98,93',
        blue: '30,61,54,50,78,58,90',
      },
      { white: '77,18,32,22,75,5,68' },
      { black: '25,74,11,80,14,4,88' },
    ],
  },
  firstSideVictory: [
    WONTS,
    'play:i7=24.j7=89.k7=73.l7=43.m7=99P.n7=40',
    'play:e7=52.f7=98A.g7=93',
    ...PASSES,
  ],
  firstSideVictoryLabels: [
    'WONTS f8 36',
    'EURIPI ET US i7 19',
    'MAW AW WO e7 27',
    ...PASSES,
  ],
  refusedOpenings: ['', 'play:', 'swap:', 'play:a1=53.b1=83', 'play:h8=53'],
};
