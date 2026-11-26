import {
  type GameLesson,
  puzzleLessonStep,
} from '@libs/game-menu-client-ts/game-lesson';
import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { sokobanStarterPack } from '@libs/sokoban-shared-ts/sokoban-starter-pack';
import { t } from '@lingui/core/macro';
import { SokobanPlayerView } from './sokoban-player';

const puzzle = sokobanStarterPack.puzzles.find(
  (entry) => entry.id === 'sokoban-starter-1'
);
if (!puzzle) throw new Error('Missing First push from Warehouse basics');
const step = (p: Parameters<typeof puzzleLessonStep>[2]) =>
  puzzleLessonStep(
    sokobanPuzzleContent.rules,
    (props) => (
      <SokobanPlayerView {...props} onReturnToLibrary={props.onLeave} />
    ),
    p
  );
export const sokobanLesson: GameLesson = [
  step({
    definition: puzzle.definition,
    accepts: (action) => action === 'r',
    prompt: () =>
      t`Walk one square right to stand beside the crate. Use the arrow key or the right arrow on screen.`,
    success: () =>
      t`You are beside the crate with an empty goal on its far side.`,
  }),
  step({
    definition: puzzle.definition,
    before: ['r'],
    accepts: (action) => action === 'r',
    prompt: () => t`Move right into the crate to push it onto the goal.`,
    success: () => t`Every crate is on a goal. You solved First push.`,
  }),
];
