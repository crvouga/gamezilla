import {
  defineScreenPlaces,
  stageShows,
} from '@pkgs/turn-game-client-ts/screen-places';

/**
 * What a game's puzzles and packs have open: the library, the builder of
 * one document, one published edition, or one saved attempt. A person opens
 * it (a row, a command); nothing else changes it.
 */
export type ContentSubject =
  | { readonly kind: 'library' }
  | { readonly kind: 'builder'; readonly documentId: string }
  | {
      readonly kind: 'edition';
      readonly revisionId: string;
      /** The pack the edition was opened from; Back returns to it. */
      readonly packRevisionId: string | null;
    }
  | { readonly kind: 'attempt'; readonly attemptId: string };

/** Where the template stands: the kind of thing that is open. */
export type ContentStage = ContentSubject['kind'];

/**
 * The library's small screens: the hub, then one list each (what to
 * continue, what is solved, what is published, what the person builds, the
 * playtests of their drafts).
 */
export type ContentLibraryPlace = {
  readonly screen:
    | 'library'
    | 'continue'
    | 'solved'
    | 'browse'
    | 'mine'
    | 'playtests';
};

/**
 * The builder's small screens: the hub of steps, the details form, the
 * board (a pack's puzzles), the preview (one of a pack's puzzles when
 * `puzzleId` is set), checking and publishing, and the kept draft copies.
 */
export type ContentBuilderPlace =
  | {
      readonly screen: 'builder' | 'details' | 'board' | 'publish' | 'copies';
    }
  | { readonly screen: 'preview'; readonly puzzleId: string | null };

/** A published edition is one screen. */
export type ContentEditionPlace = { readonly screen: 'edition' };

/** An attempt's small screens: the board, and where the attempt stands. */
export type ContentAttemptPlace = { readonly screen: 'attempt' | 'progress' };

/** The places of each stage. */
export type ContentStagePlace = {
  readonly library: ContentLibraryPlace;
  readonly builder: ContentBuilderPlace;
  readonly edition: ContentEditionPlace;
  readonly attempt: ContentAttemptPlace;
};

export type ContentPlace = ContentStagePlace[ContentStage];

/** Every stage opens on its hub; the attempt on its board. */
const HOME: { readonly [Stage in ContentStage]: ContentStagePlace[Stage] } = {
  library: { screen: 'library' },
  builder: { screen: 'builder' },
  edition: { screen: 'edition' },
  attempt: { screen: 'attempt' },
};

/**
 * The puzzle library template's places. A pack's previewed puzzle leads
 * back to the pack's preview, everything else to its stage's home.
 */
export const CONTENT_PLACES = defineScreenPlaces<ContentStage, ContentPlace>({
  home: HOME,
  screens: {
    library: ['library', 'continue', 'solved', 'browse', 'mine', 'playtests'],
    builder: ['builder', 'details', 'board', 'preview', 'publish', 'copies'],
    edition: ['edition'],
    attempt: ['attempt', 'progress'],
  },
  parent: (place) =>
    place.screen === 'preview' && place.puzzleId !== null
      ? { screen: 'preview', puzzleId: null }
      : null,
});

/** The stage a subject puts the template in. */
export function contentStageOf(subject: ContentSubject): ContentStage {
  return subject.kind;
}

/**
 * `place` as one of `stage`'s own places: itself when the stage shows it,
 * the stage's home otherwise, so a stage's view never draws another's.
 */
export function contentPlaceOf<Stage extends ContentStage>(
  stage: Stage,
  place: ContentPlace
): ContentStagePlace[Stage] {
  return stageShows(CONTENT_PLACES, stage, place)
    ? (place as ContentStagePlace[Stage])
    : HOME[stage];
}
