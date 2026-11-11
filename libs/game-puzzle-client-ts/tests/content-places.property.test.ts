import { describe, expect, test } from 'bun:test';
import {
  CONTENT_PLACES,
  type ContentPlace,
  type ContentStage,
  type ContentSubject,
  contentPlaceOf,
  contentStageOf,
} from '@libs/game-puzzle-client-ts/content-places';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  type OpenedPlace,
  placeBehind,
  placeIn,
  stageShows,
} from '@pkgs/turn-game-client-ts/screen-places';
import fc from 'fast-check';

const subject = fc.oneof(
  fc.constant<ContentSubject>({ kind: 'library' }),
  fc
    .constantFrom('doc-a', 'doc-b')
    .map((documentId): ContentSubject => ({ kind: 'builder', documentId })),
  fc.constantFrom('rev-a', 'rev-b').chain((revisionId) =>
    fc.constantFrom(null, 'pack-a').map(
      (packRevisionId): ContentSubject => ({
        kind: 'edition',
        revisionId,
        packRevisionId,
      })
    )
  ),
  fc
    .constantFrom('attempt-a', 'attempt-b')
    .map((attemptId): ContentSubject => ({ kind: 'attempt', attemptId }))
);

const place = fc.oneof(
  fc.constantFrom<ContentPlace>(
    { screen: 'library' },
    { screen: 'continue' },
    { screen: 'solved' },
    { screen: 'browse' },
    { screen: 'mine' },
    { screen: 'playtests' },
    { screen: 'builder' },
    { screen: 'details' },
    { screen: 'board' },
    { screen: 'publish' },
    { screen: 'copies' },
    { screen: 'edition' },
    { screen: 'attempt' },
    { screen: 'progress' }
  ),
  fc
    .constantFrom(null, 'puzzle-a', 'puzzle-b')
    .map((puzzleId): ContentPlace => ({ screen: 'preview', puzzleId }))
);

type Step =
  | { readonly kind: 'open'; readonly subject: ContentSubject }
  | { readonly kind: 'place'; readonly place: ContentPlace }
  | { readonly kind: 'back' };

const step = fc.oneof(
  subject.map((opened): Step => ({ kind: 'open', subject: opened })),
  place.map((opened): Step => ({ kind: 'place', place: opened })),
  fc.constant<Step>({ kind: 'back' })
);

type Seen = {
  readonly subject: ContentSubject;
  readonly place: ContentPlace;
  /** Back was pressed on a home: the template was left for the library, or out. */
  readonly left: boolean;
};

/** A device walking the template as `ContentExperience` does. */
function walk(steps: readonly Step[]): Seen[] {
  let open: ContentSubject = { kind: 'library' };
  let opened: OpenedPlace<ContentStage, ContentPlace> | null = null;
  const seen: Seen[] = [];
  for (const next of steps) {
    const stage = contentStageOf(open);
    let left = false;
    if (next.kind === 'open') {
      open = next.subject;
      opened = null;
    }
    if (next.kind === 'place') opened = { stage, place: next.place };
    if (next.kind === 'back') {
      const behind: ContentPlace | null = placeBehind(
        CONTENT_PLACES,
        stage,
        placeIn(CONTENT_PLACES, stage, opened)
      );
      if (behind === null) left = true;
      else opened = { stage, place: behind };
    }
    seen.push({
      subject: open,
      place: placeIn(CONTENT_PLACES, contentStageOf(open), opened),
      left,
    });
  }
  return seen;
}

describe('puzzle library places', () => {
  test('whatever is opened, the place shown is one its stage shows', () => {
    assertProperty(
      'shown place belongs to its stage',
      fc.property(fc.array(step, { maxLength: 40 }), (steps) => {
        for (const seen of walk(steps)) {
          const stage = contentStageOf(seen.subject);
          expect(stageShows(CONTENT_PLACES, stage, seen.place)).toBe(true);
          expect(contentPlaceOf(stage, seen.place)).toEqual(seen.place);
        }
      })
    );
  });

  test('opening anything lands on its home, also another of the same kind', () => {
    assertProperty(
      'opening resets the place',
      fc.property(
        fc.array(step, { maxLength: 20 }),
        subject,
        (before, next) => {
          const seen = walk([...before, { kind: 'open', subject: next }]).at(
            -1
          );
          expect(seen?.place).toEqual(
            CONTENT_PLACES.home[contentStageOf(next)]
          );
        }
      )
    );
  });

  test('a place opened in one stage never shows in another', () => {
    assertProperty(
      'another stage shows its own home',
      fc.property(subject, place, subject, (from, opened, to) => {
        fc.pre(contentStageOf(from) !== contentStageOf(to));
        expect(
          placeIn(CONTENT_PLACES, contentStageOf(to), {
            stage: contentStageOf(from),
            place: opened,
          })
        ).toEqual(CONTENT_PLACES.home[contentStageOf(to)]);
      })
    );
  });

  test('Back reaches the home, then leaves, in a bounded number of steps', () => {
    assertProperty(
      'back terminates at the home',
      fc.property(subject, place, (open, opened) => {
        const stage = contentStageOf(open);
        let shown: ContentPlace | null = placeIn(CONTENT_PLACES, stage, {
          stage,
          place: opened,
        });
        let steps = 0;
        while (
          shown !== null &&
          steps <= CONTENT_PLACES.screens[stage].length
        ) {
          shown = placeBehind(CONTENT_PLACES, stage, shown);
          steps += 1;
        }
        expect(shown).toBeNull();
      })
    );
  });

  test("a stage's view is never handed another stage's place", () => {
    assertProperty(
      'contentPlaceOf falls back to the home',
      fc.property(subject, place, (open, any) => {
        const stage = contentStageOf(open);
        const shown = contentPlaceOf(stage, any);
        expect(stageShows(CONTENT_PLACES, stage, shown)).toBe(true);
        if (!stageShows(CONTENT_PLACES, stage, any))
          expect(shown).toEqual(CONTENT_PLACES.home[stage]);
      })
    );
  });

  test("a pack's previewed puzzle leads back to the pack's preview, then the hub", () => {
    const puzzle: ContentPlace = { screen: 'preview', puzzleId: 'puzzle-a' };
    expect(placeBehind(CONTENT_PLACES, 'builder', puzzle)).toEqual({
      screen: 'preview',
      puzzleId: null,
    });
    expect(
      placeBehind(CONTENT_PLACES, 'builder', {
        screen: 'preview',
        puzzleId: null,
      })
    ).toEqual({ screen: 'builder' });
    expect(
      placeBehind(CONTENT_PLACES, 'builder', { screen: 'builder' })
    ).toBeNull();
    for (const screen of ['details', 'board', 'publish', 'copies'] as const)
      expect(placeBehind(CONTENT_PLACES, 'builder', { screen })).toEqual({
        screen: 'builder',
      });
    expect(
      placeBehind(CONTENT_PLACES, 'attempt', { screen: 'progress' })
    ).toEqual({ screen: 'attempt' });
    for (const screen of [
      'continue',
      'solved',
      'browse',
      'mine',
      'playtests',
    ] as const)
      expect(placeBehind(CONTENT_PLACES, 'library', { screen })).toEqual({
        screen: 'library',
      });
  });
});
