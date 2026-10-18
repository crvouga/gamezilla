import { retireCataloguePuzzle } from '@libs/game-session-harness/puzzle-records';
import { scenarioAction } from '@libs/harness/actor-ui';
import { ingestChessPuzzleCsv, readServerPuzzles } from './chess-puzzle-data';

/** Three distinct canonical mates, each with two solver moves. */
const POOL = [
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags',
  '01Xbe,8/3R3p/6pk/3p4/2p1b1P1/6KP/r7/4R3 w - - 0 41,g3h4 g6g5 h4g3 a2g2,1190,76,100,220,mate mateIn2,,',
  '002X3,6k1/2q2p1p/4pPp1/4P3/p1pP1P2/RrP5/6QP/4B1K1 b - - 0 33,b3a3 g2a8 c7b8 a8b8,1505,75,95,400,mate mateIn2,,',
  '007mr,5k2/p2r3p/1p4pP/3r1q2/3Rp3/2P5/PP3PQ1/K3R3 w - - 0 33,d4e4 d5d1 e1d1 d7d1,1550,75,95,400,mate mateIn2,,',
].join('\n');

export const preparePuzzleModelPool = scenarioAction({
  name: 'preparePuzzleModelPool',
  act: async (s) => {
    for (const puzzle of await readServerPuzzles(s)) {
      if (puzzle.id !== '01Xbe')
        await Promise.resolve(retireCataloguePuzzle.act(s, puzzle.id));
    }
    await Promise.resolve(ingestChessPuzzleCsv.act(s, POOL));
  },
});
