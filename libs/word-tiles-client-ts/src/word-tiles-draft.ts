import {
  decodePosition,
  type WordTilesPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';
import type { GameBoardProps } from '@pkgs/turn-game-shared-ts/game-presentation';
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
  untrack,
} from 'solid-js';
import {
  type LexiconState,
  useWordTilesLexicon,
} from './use-word-tiles-lexicon';
import { type Candidate, newCandidate, rebase } from './word-tiles-candidate';
import { previewCandidate, type WordTilesPreview } from './word-tiles-preview';

/**
 * One seat's move in the making, shared by the board, its actions and its
 * controls: the position as decoded, the candidate laid on it, and what the
 * candidate would score.
 */
export type WordTilesDraft = {
  readonly props: GameBoardProps;
  /** The position, `null` when this app cannot read it. */
  readonly position: Accessor<WordTilesPosition | null>;
  readonly candidate: Accessor<Candidate>;
  readonly update: (change: (candidate: Candidate) => Candidate) => void;
  /** Whether the viewer holds a rack in a game still being played. */
  readonly editable: Accessor<boolean>;
  /** The candidate's preview, `null` when the position cannot be read. */
  readonly preview: Accessor<WordTilesPreview | null>;
  readonly lexicon: {
    readonly state: Accessor<LexiconState>;
    readonly retry: () => void;
  };
};

/** The draft of the seat `props` shows, following its position and rack. */
export function createWordTilesDraft(props: GameBoardProps): WordTilesDraft {
  const position = createMemo(() => decodePosition(props.position));
  const [candidate, setCandidate] = createSignal(
    untrack(() => newCandidate(props.position, props.hand))
  );
  // A candidate follows the position and rack it was made on; tiles that
  // are no longer possible go back, the rest stay tentative.
  createEffect(
    on([() => props.position, () => props.hand, () => props.syncKey], () =>
      setCandidate((c) => rebase(c, props.position, props.hand))
    )
  );
  const lexicon = useWordTilesLexicon(() => position()?.lexicon ?? '');
  const preview = createMemo(() => {
    const decoded = position();
    return decoded === null
      ? null
      : previewCandidate(decoded, candidate(), lexicon.state());
  });
  return {
    props,
    position,
    candidate,
    update: (change) => setCandidate(change),
    editable: () => props.hand !== null && position()?.ended === null,
    preview,
    lexicon,
  };
}
