import { defineGame } from '@libs/game-session-shared-ts/game-definition';
import { numberlinkPuzzleContent } from './numberlink-puzzle-content';

export const numberlinkGameShared = defineGame({
  id: 'numberlink',
  puzzleContent: numberlinkPuzzleContent,
});
