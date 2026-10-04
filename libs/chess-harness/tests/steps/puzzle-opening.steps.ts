import { NAMED_PUZZLES } from '@libs/chess-puzzle-harness/puzzle-fixtures';
import { When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { enterNamedPuzzle } from './puzzle-world';

When('{actor} opens the two-rook clearance puzzle', async (w, actor: Actor) => {
  await enterNamedPuzzle(w, actor, NAMED_PUZZLES.twoRookClearance);
});
When(
  '{actor} opens the puzzle Black solves by promoting',
  async (w, actor: Actor) => {
    await enterNamedPuzzle(w, actor, NAMED_PUZZLES.blackPromotes);
  }
);
When(
  '{actor} opens the puzzle that starts with White in check',
  async (w, actor: Actor) => {
    await enterNamedPuzzle(w, actor, NAMED_PUZZLES.whiteInCheck);
  }
);
