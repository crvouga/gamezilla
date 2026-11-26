import {
  type GameLesson,
  puzzleLessonStep,
} from '@libs/game-menu-client-ts/game-lesson';
import type { PuzzlePlayerProps } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { DEFAULT_LEXICON_KEY } from '@libs/word-tiles-shared-ts/word-tiles-lexicon';
import {
  INITIAL_WORD_TILES_PUZZLE_STATE,
  wordTilesPuzzleContent,
} from '@libs/word-tiles-shared-ts/word-tiles-puzzle';
import { WORD_TILES_STARTER } from '@libs/word-tiles-shared-ts/word-tiles-starter';
import { t } from '@lingui/core/macro';
import { useWordTilesLexicon } from './use-word-tiles-lexicon';
import { WordTilesPuzzlePlayerView } from './word-tiles-puzzle-player-view';

function Placement(props: PuzzlePlayerProps & { onLeave: () => void }) {
  const lexicon = useWordTilesLexicon(() => DEFAULT_LEXICON_KEY);
  return (
    <WordTilesPuzzlePlayerView
      {...props}
      lexicon={lexicon.state()}
      onRetryLexicon={lexicon.retry}
      onReturnToLibrary={props.onLeave}
    />
  );
}
const rules = wordTilesPuzzleContent.rules;
function placement(id: string, prompt: () => string, success: () => string) {
  const puzzle = WORD_TILES_STARTER.puzzles.find((entry) => entry.id === id);
  if (!puzzle) throw new Error(`Unknown starter puzzle: ${id}`);
  const definition = puzzle.definition;
  return puzzleLessonStep(rules, Placement, {
    definition,
    prompt,
    success,
    initial: () => INITIAL_WORD_TILES_PUZZLE_STATE,
    reachedGoal: (state) => rules.complete(definition, state),
  });
}
export const wordTilesLesson: GameLesson = [
  placement(
    'first-word',
    () =>
      t`Make a word worth 10 across the star. Try C on G8, A on H8 and T on I8, then choose Play word.`,
    () => t`The centre doubled your opening word's score.`
  ),
  placement(
    'make-it-longer',
    () =>
      t`Extend CAT for at least 8 points. Try S on J8, then play your word.`,
    () =>
      t`Your new tile joined the word already on the board. Only newly covered bonus squares count.`
  ),
];
