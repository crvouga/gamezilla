import { decodePosition } from '@libs/word-tiles-shared-ts/word-tiles-position';
import type { GameFrameBoardSession } from '@pkgs/turn-game-shared-ts/game-frame';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import { useRandom } from '@pkgs/uuid-client-ts/solid';
import type { JSX } from 'solid-js';
import { useWordTilesLexicon } from './use-word-tiles-lexicon';
import {
  createWordTilesSession,
  WordTilesBoardView,
} from './word-tiles-board-view';

/** The word list the position in `props` pins, loaded when first needed. */
function usePinnedLexicon(props: GameBoardProps) {
  return useWordTilesLexicon(
    () => decodePosition(props.position)?.lexicon ?? ''
  );
}

/**
 * One seat's Word Tiles session for the frame: the session with the word
 * list its position pins and the app's shuffle.
 */
export function createWordTilesBoard(
  props: GameBoardProps
): Required<GameFrameBoardSession<JSX.Element>> {
  return createWordTilesSession(props, {
    lexicon: usePinnedLexicon(props),
    random: useRandom(),
  });
}

/**
 * The whole session as one board, for screens that show a game without
 * the frame around it (matched games, a game's history).
 */
export function WordTilesBoard(props: GameBoardProps): JSX.Element {
  const lexicon = usePinnedLexicon(props);
  const random = useRandom();
  return (
    <WordTilesBoardView
      {...props}
      lexicon={lexicon.state()}
      onRetryLexicon={lexicon.retry}
      random={random}
    />
  );
}
