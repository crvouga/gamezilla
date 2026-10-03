import type { NamedPuzzle } from '@libs/chess/harness/puzzle-fixtures';

const HEADER =
  'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags';
function puzzle(
  id: string,
  fen: string,
  moves: string,
  theme: NamedPuzzle['theme']
): NamedPuzzle {
  return {
    id,
    theme,
    csv: `${HEADER}\n${id},${fen},${moves},1200,80,100,100,${theme},,`,
  };
}

export const ASSISTANT_PUZZLES = {
  exposed: puzzle(
    'coachHang',
    '4k3/8/8/3r4/8/8/3N4/6K1 b - - 0 1',
    'd5d4 d2f3',
    'hangingPiece'
  ),
  defended: puzzle(
    'coachDef',
    '4k3/8/8/3r4/8/8/3N4/2B3K1 b - - 0 1',
    'd5d4 d2f3',
    'defensiveMove'
  ),
  fork: puzzle(
    'coachFork',
    '4k3/p7/8/5n2/8/8/7P/3Q1K2 b - - 0 1',
    'a7a6 d1d3',
    'fork'
  ),
  falseFork: puzzle(
    'coachLabel',
    '4k3/p7/8/8/8/8/8/4K2R b K - 0 1',
    'a7a6 e1g1',
    'fork'
  ),
  checked: puzzle(
    'coachCheck',
    '4k3/8/8/7q/3r4/8/3N4/4K2R b - - 0 1',
    'h5h4 h1h4',
    'defensiveMove'
  ),
  mate: puzzle(
    'coachMate',
    '7k/RR6/8/p7/4p3/3N4/8/6K1 b - - 0 1',
    'a5a4 b7b8',
    'anastasiaMate'
  ),
} as const;
