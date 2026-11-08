import { resolveProposal } from '@libs/word-tiles-shared-ts/word-tiles-authority';
import {
  decodeHidden,
  encodeHidden,
} from '@libs/word-tiles-shared-ts/word-tiles-hidden';
import { playEncoded } from '@libs/word-tiles-shared-ts/word-tiles-play';
import {
  decodePosition,
  encodePosition,
  newPosition,
} from '@libs/word-tiles-shared-ts/word-tiles-position';
import { TILES } from '@libs/word-tiles-shared-ts/word-tiles-tiles';
import { createSignal, mergeProps } from 'solid-js';
import type { LexiconState } from './use-word-tiles-lexicon';
import type { WordTilesBoardViewProps } from './word-tiles-board-view';
import {
  STORY_LEXICON,
  STORY_LEXICON_KEY,
} from './word-tiles-board-view.example';

/** Controlled authority fixture: only genuine accepted proposals update the table. */
export function matchJourney(args: WordTilesBoardViewProps) {
  const seats = decodePosition(args.position)?.seats;
  if (seats === undefined) throw new Error('Missing fixture seat count');
  const rack = [11, 0, 82, 98, 25, 77, 69];
  const rest = TILES.map((tile) => tile.id).filter((id) => !rack.includes(id));
  let hidden = encodeHidden({
    racks: [
      rack,
      ...Array.from({ length: seats - 1 }, (_, index) =>
        rest.slice(index * 7, (index + 1) * 7)
      ),
    ],
    bag: rest.slice((seats - 1) * 7),
    board: [],
    rng: [1, 2, 3, 4],
  });
  const [position, setPosition] = createSignal(
    encodePosition(newPosition(seats, STORY_LEXICON_KEY))
  );
  const [hand, setHand] = createSignal(rack.join(','));
  const [interactive, setInteractive] = createSignal(true);
  const [lexicon, setLexicon] = createSignal<LexiconState>(args.lexicon);
  return mergeProps(args, {
    get position() {
      return position();
    },
    get hand() {
      return hand();
    },
    get interactive() {
      return interactive();
    },
    get lexicon() {
      return lexicon();
    },
    onRetryLexicon: () => setLexicon(STORY_LEXICON),
    onAction: (proposal: string) => {
      if (STORY_LEXICON.status !== 'ready')
        throw new Error('Missing fixture lexicon');
      const resolution = resolveProposal(
        position(),
        proposal,
        hidden,
        STORY_LEXICON.lexicon
      );
      if (!resolution.ok) throw new Error(resolution.refusal);
      const next = playEncoded(position(), resolution.action);
      if (next === null) throw new Error('Accepted action failed replay');
      hidden = resolution.hidden;
      setPosition(next.position);
      const nextRack = decodeHidden(hidden, seats)?.racks[0];
      if (!nextRack) throw new Error('Accepted action has no local rack');
      setHand(nextRack.join(','));
      setInteractive(false);
    },
  });
}
