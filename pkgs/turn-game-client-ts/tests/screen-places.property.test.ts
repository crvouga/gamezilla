import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  defineScreenPlaces,
  type OpenedPlace,
  placeBehind,
  placeIn,
  stageShows,
} from '@pkgs/turn-game-client-ts/screen-places';
import fc from 'fast-check';

type Stage = 'setup' | 'play' | 'over';
type Place =
  | { readonly screen: 'lobby' | 'options' | 'board' | 'moves' | 'result' }
  | { readonly screen: 'seat'; readonly side: 'white' | 'black' };

const PLACES = defineScreenPlaces<Stage, Place>({
  home: {
    setup: { screen: 'lobby' },
    play: { screen: 'board' },
    over: { screen: 'result' },
  },
  screens: {
    setup: ['lobby', 'seat', 'options'],
    play: ['board', 'moves'],
    over: ['result', 'moves'],
  },
  parent: (place) => (place.screen === 'seat' ? { screen: 'options' } : null),
});

const stage = fc.constantFrom<Stage>('setup', 'play', 'over');
const place = fc.oneof(
  fc.constantFrom<Place>(
    { screen: 'lobby' },
    { screen: 'options' },
    { screen: 'board' },
    { screen: 'moves' },
    { screen: 'result' }
  ),
  fc.constantFrom<Place>(
    { screen: 'seat', side: 'white' },
    { screen: 'seat', side: 'black' }
  )
);

type Step =
  | { readonly kind: 'open'; readonly place: Place }
  | { readonly kind: 'back' }
  | { readonly kind: 'stage'; readonly stage: Stage };

const step = fc.oneof(
  place.map((opened): Step => ({ kind: 'open', place: opened })),
  fc.constant<Step>({ kind: 'back' }),
  stage.map((next): Step => ({ kind: 'stage', stage: next }))
);

/** A device walking the machine as `useScreenPlace` does. */
function walk(steps: readonly Step[]): { stage: Stage; place: Place }[] {
  let at: Stage = 'setup';
  let opened: OpenedPlace<Stage, Place> | null = null;
  const seen: { stage: Stage; place: Place }[] = [];
  for (const next of steps) {
    if (next.kind === 'stage') at = next.stage;
    if (next.kind === 'open') opened = { stage: at, place: next.place };
    if (next.kind === 'back') {
      const behind: Place | null = placeBehind(
        PLACES,
        at,
        placeIn(PLACES, at, opened)
      );
      opened = behind === null ? null : { stage: at, place: behind };
    }
    seen.push({ stage: at, place: placeIn(PLACES, at, opened) });
  }
  return seen;
}

describe('screen places', () => {
  test('whatever is opened, the place shown is one its stage shows', () => {
    assertProperty(
      'shown place belongs to its stage',
      fc.property(fc.array(step, { maxLength: 30 }), (steps) => {
        for (const seen of walk(steps))
          expect(stageShows(PLACES, seen.stage, seen.place)).toBe(true);
      })
    );
  });

  test('a stage change lands on the new stage home', () => {
    assertProperty(
      'stage change resets the place',
      fc.property(stage, place, stage, (from, opened, to) => {
        fc.pre(from !== to);
        expect(placeIn(PLACES, to, { stage: from, place: opened })).toEqual(
          PLACES.home[to]
        );
      })
    );
  });

  test('Back reaches the home, then leaves, in a bounded number of steps', () => {
    assertProperty(
      'back terminates at the home',
      fc.property(stage, place, (at, opened) => {
        let shown: Place | null = placeIn(PLACES, at, {
          stage: at,
          place: opened,
        });
        let steps = 0;
        while (shown !== null && steps <= PLACES.screens[at].length) {
          shown = placeBehind(PLACES, at, shown);
          steps += 1;
        }
        expect(shown).toBeNull();
      })
    );
  });

  test('a place keeps what it carries while its stage shows it', () => {
    const seat: Place = { screen: 'seat', side: 'black' };
    expect(placeIn(PLACES, 'setup', { stage: 'setup', place: seat })).toEqual(
      seat
    );
    expect(placeBehind(PLACES, 'setup', seat)).toEqual({ screen: 'options' });
    expect(placeBehind(PLACES, 'setup', { screen: 'options' })).toEqual({
      screen: 'lobby',
    });
    expect(placeBehind(PLACES, 'setup', { screen: 'lobby' })).toBeNull();
  });

  test('a stage whose home is not one of its screens is refused', () => {
    expect(() =>
      defineScreenPlaces<'only', { readonly screen: 'a' | 'b' }>({
        home: { only: { screen: 'a' } },
        screens: { only: ['b'] },
        parent: () => null,
      })
    ).toThrow('only: its home "a" is not one of its screens');
  });
});
