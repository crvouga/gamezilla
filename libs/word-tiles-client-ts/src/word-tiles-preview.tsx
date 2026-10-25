import {
  evaluatePlacement,
  type PlacementRefusal,
  type ScoredWord,
  unknownWords,
} from '@libs/word-tiles-shared-ts/word-tiles-placement';
import type { WordTilesPosition } from '@libs/word-tiles-shared-ts/word-tiles-position';
import { tileSymbol } from '@libs/word-tiles-shared-ts/word-tiles-tiles';
import { t } from '@lingui/core/macro';
import type { LexiconState } from './use-word-tiles-lexicon';
import type { Candidate } from './word-tiles-candidate';

/**
 * The private, advisory preview of the viewer's candidate, from the game's
 * own placement rules and (once loaded) its pinned word list. It never
 * replaces the authority's decision: a candidate the preview accepts may
 * still be refused, and while the list loads the preview only scores.
 */
export type WordTilesPreview =
  | {
      readonly kind: 'score';
      readonly words: readonly ScoredWord[];
      readonly bonus: number;
      readonly total: number;
      /** Whether the word list confirmed every word. */
      readonly checked: boolean;
      readonly playable: boolean;
      readonly message: string;
    }
  | {
      readonly kind: 'none';
      readonly playable: boolean;
      readonly message: string;
    };

export function refusalText(refusal: PlacementRefusal): string {
  return {
    'no tiles': t`Place tiles from your rack on the board.`,
    'cell taken': t`That square already holds a tile.`,
    'not in one line': t`Place every tile in one row or one column.`,
    'gap in the word': t`Leave no gap between your tiles.`,
    'not connected': t`Join your word to the tiles on the board.`,
    'must cover the centre': t`The first word must cover the centre star.`,
    'too short': t`Words have at least two letters.`,
  }[refusal];
}

function exchangePreview(
  position: WordTilesPosition,
  count: number
): WordTilesPreview {
  if (position.bag < 7)
    return {
      kind: 'none',
      playable: false,
      message: t`Exchanging needs at least seven tiles in the bag.`,
    };
  return count === 0
    ? {
        kind: 'none',
        playable: false,
        message: t`Choose the tiles to exchange.`,
      }
    : {
        kind: 'none',
        playable: true,
        message: t`Exchange ${count} tiles and score nothing this turn.`,
      };
}

export function previewCandidate(
  position: WordTilesPosition,
  candidate: Candidate,
  lexicon: LexiconState
): WordTilesPreview {
  if (candidate.exchange !== null)
    return exchangePreview(position, candidate.exchange.length);
  if (candidate.placed.length === 0)
    return {
      kind: 'none',
      playable: false,
      message: t`Choose a tile, then a square.`,
    };
  if (candidate.blankAt !== null)
    return {
      kind: 'none',
      playable: false,
      message: t`Choose the letter your blank plays.`,
    };
  const placed = candidate.placed.map((p) => ({
    cell: p.cell,
    letter: p.assigned ?? tileSymbol(p.tile),
    blank: p.assigned !== null,
  }));
  const evaluation = evaluatePlacement(position.board, placed);
  if (!evaluation.ok)
    return {
      kind: 'none',
      playable: false,
      message: refusalText(evaluation.refusal),
    };
  const { words, bonus, total } = evaluation.score;
  const base = { kind: 'score', words, bonus, total } as const;
  if (lexicon.status !== 'ready')
    return {
      ...base,
      checked: false,
      playable: true,
      message:
        lexicon.status === 'loading'
          ? t`Scores ${total} points. Checking the words…`
          : t`Scores ${total} points. The word list could not load here; the game checks the words when you play.`,
    };
  const unknown = unknownWords(evaluation.score, lexicon.lexicon.has);
  const missing = unknown.join(', ');
  return unknown.length > 0
    ? {
        ...base,
        checked: true,
        playable: false,
        message: t`Not in the word list: ${missing}`,
      }
    : {
        ...base,
        checked: true,
        playable: true,
        message: t`Scores ${total} points.`,
      };
}
