import { describe, expect, test } from 'bun:test';
import {
  MULTIPLAYER_PLACES,
  type MultiplayerPlace,
  type MultiplayerStage,
  type MultiplayerStanding,
  multiplayerPlaceKept,
  multiplayerStageOf,
} from '@libs/game-matchmaking-client-ts/multiplayer-places';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import {
  type OpenedPlace,
  placeBehind,
  placeIn,
  stageShows,
} from '@pkgs/turn-game-client-ts/screen-places';
import fc from 'fast-check';

const STAGES = Object.keys(MULTIPLAYER_PLACES.home) as MultiplayerStage[];
const SCREENS = [
  ...new Set(STAGES.flatMap((stage) => MULTIPLAYER_PLACES.screens[stage])),
];

const stage = fc.constantFrom<MultiplayerStage>(...STAGES);
const place = fc.oneof(
  fc
    .constantFrom(...SCREENS.filter((screen) => screen !== 'ratings'))
    .map((screen): MultiplayerPlace => ({ screen })),
  fc
    .constantFrom<'find' | 'result'>('find', 'result')
    .map((from): MultiplayerPlace => ({ screen: 'ratings', from }))
);

type Step =
  | { readonly kind: 'open'; readonly place: MultiplayerPlace }
  | { readonly kind: 'back' }
  | { readonly kind: 'stage'; readonly stage: MultiplayerStage };

const step = fc.oneof(
  place.map((opened): Step => ({ kind: 'open', place: opened })),
  fc.constant<Step>({ kind: 'back' }),
  stage.map((next): Step => ({ kind: 'stage', stage: next }))
);

type Seen = {
  readonly stage: MultiplayerStage;
  readonly place: MultiplayerPlace;
};
type Opened = OpenedPlace<MultiplayerStage, MultiplayerPlace> | null;

/** One step of a device, as `useMultiplayerPlaces` takes it. */
function after(at: Seen, opened: Opened, next: Step): Opened {
  if (next.kind === 'open') return { stage: at.stage, place: next.place };
  if (next.kind === 'back') {
    const behind = placeBehind(MULTIPLAYER_PLACES, at.stage, at.place);
    return behind === null ? null : { stage: at.stage, place: behind };
  }
  const kept = multiplayerPlaceKept(at, next.stage);
  return kept === null ? opened : { stage: next.stage, place: kept };
}

/** A device walking the machine from `idle`. */
function walk(steps: readonly Step[]): Seen[] {
  let at: Seen = { stage: 'idle', place: MULTIPLAYER_PLACES.home.idle };
  let opened: Opened = null;
  const seen: Seen[] = [];
  for (const next of steps) {
    opened = after(at, opened, next);
    const reached = next.kind === 'stage' ? next.stage : at.stage;
    at = {
      stage: reached,
      place: placeIn(MULTIPLAYER_PLACES, reached, opened),
    };
    seen.push(at);
  }
  return seen;
}

const standing = fc.record<MultiplayerStanding>({
  denied: fc.boolean(),
  loading: fc.boolean(),
  game: fc.option(
    fc.record({ ongoing: fc.boolean(), awaitingSetups: fc.boolean() }),
    { nil: null }
  ),
  searching: fc.boolean(),
  mayFind: fc.boolean(),
});

/** The stage a standing is in, decided one question at a time. */
function expectedStage(facts: MultiplayerStanding): MultiplayerStage {
  const candidates: readonly [boolean, MultiplayerStage][] = [
    [facts.denied, 'denied'],
    [facts.game?.ongoing === true && facts.game.awaitingSetups, 'setup'],
    [facts.game?.ongoing === true, 'playing'],
    [facts.searching, 'searching'],
    [facts.game !== null, 'finished'],
    [facts.loading, 'loading'],
    [facts.mayFind, 'idle'],
  ];
  return candidates.find(([holds]) => holds)?.[1] ?? 'unavailable';
}

describe('the places of finding an opponent', () => {
  test('whatever is opened, the place shown is one its stage shows', () => {
    assertProperty(
      'shown place belongs to its stage',
      fc.property(fc.array(step, { maxLength: 30 }), (steps) => {
        for (const seen of walk(steps))
          expect(stageShows(MULTIPLAYER_PLACES, seen.stage, seen.place)).toBe(
            true
          );
      })
    );
  });

  test('Back reaches the home, then leaves, in a bounded number of steps', () => {
    assertProperty(
      'back terminates at the home',
      fc.property(stage, place, (at, opened) => {
        let shown: MultiplayerPlace | null = placeIn(MULTIPLAYER_PLACES, at, {
          stage: at,
          place: opened,
        });
        let steps = 0;
        while (
          shown !== null &&
          steps <= MULTIPLAYER_PLACES.screens[at].length
        ) {
          shown = placeBehind(MULTIPLAYER_PLACES, at, shown);
          steps += 1;
        }
        expect(shown).toBeNull();
      })
    );
  });

  test('a stage change lands on the new home, except the moves of a game that ends', () => {
    assertProperty(
      'only a review outlives its stage',
      fc.property(stage, place, stage, (from, opened, to) => {
        fc.pre(from !== to);
        const before = {
          stage: from,
          place: placeIn(MULTIPLAYER_PLACES, from, {
            stage: from,
            place: opened,
          }),
        };
        const kept = multiplayerPlaceKept(before, to);
        const shown = placeIn(
          MULTIPLAYER_PLACES,
          to,
          kept === null
            ? { stage: from, place: opened }
            : { stage: to, place: kept }
        );
        const reviewing =
          from === 'playing' && to === 'finished' && opened.screen === 'moves';
        expect(shown).toEqual(
          reviewing ? { screen: 'moves' } : MULTIPLAYER_PLACES.home[to]
        );
      })
    );
  });

  test('the stage is decided by the data alone, in one order', () => {
    assertProperty(
      'stage of a standing',
      fc.property(standing, (facts) => {
        expect(multiplayerStageOf(facts)).toBe(expectedStage(facts));
      })
    );
  });

  test('every place is reachable in some stage and each stage opens on its own home', () => {
    const every: MultiplayerPlace['screen'][] = [
      'commands',
      'find',
      'guide',
      'moves',
      'play',
      'private-setup',
      'ratings',
      'result',
      'searching',
      'status',
      'time-control',
    ];
    expect(SCREENS.toSorted()).toEqual(every);
    expect(
      STAGES.map((at) => [at, MULTIPLAYER_PLACES.home[at].screen])
    ).toEqual([
      ['loading', 'status'],
      ['unavailable', 'status'],
      ['denied', 'status'],
      ['idle', 'find'],
      ['searching', 'searching'],
      ['setup', 'private-setup'],
      ['playing', 'play'],
      ['finished', 'result'],
    ]);
  });

  test('Back leads to where a place was opened from, and from a home it leaves', () => {
    const behind = (at: MultiplayerStage, shown: MultiplayerPlace) =>
      placeBehind(MULTIPLAYER_PLACES, at, shown)?.screen;
    const at = (
      screen: Exclude<MultiplayerPlace['screen'], 'ratings'>
    ): MultiplayerPlace => ({ screen });
    expect(behind('finished', { screen: 'ratings', from: 'result' })).toBe(
      'result'
    );
    expect(behind('finished', { screen: 'ratings', from: 'find' })).toBe(
      'find'
    );
    expect(behind('idle', { screen: 'ratings', from: 'find' })).toBe('find');
    // A finished game's hub and moves lead back to its result.
    expect(behind('finished', at('find'))).toBe('result');
    expect(behind('finished', at('time-control'))).toBe('find');
    expect(behind('finished', at('moves'))).toBe('result');
    expect(behind('playing', at('moves'))).toBe('play');
    expect(behind('playing', at('commands'))).toBe('play');
    expect(behind('setup', at('commands'))).toBe('private-setup');
    expect(behind('idle', at('time-control'))).toBe('find');
    expect(behind('idle', at('find'))).toBeUndefined();
  });
});
